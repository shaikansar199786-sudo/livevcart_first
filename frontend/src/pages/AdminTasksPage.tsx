import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Plus,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Users,
    Check,
    X,
    Filter,
    Search,
    Calendar,
    Send,
    Briefcase,
    ChevronRight,
    Edit3,
    Trash2,
    ShieldAlert,
    Sparkles,
    CheckSquare,
    Layers,
    XCircle,
    RotateCcw,
    Play
} from 'lucide-react';
import liveLogo from '../assets/1.png';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

interface SubTaskForm {
    title: string;
    start_date: string;
    duration_days: number;
}

export const AdminTasksPage: React.FC = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Filters state
    const [statementPeriod, setStatementPeriod] = useState<string>('all_time');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [statusFilterTab, setStatusFilterTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal state for Assign Task
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignForm, setAssignForm] = useState({
        user_id: '',
        task_title: '',
        description: '',
        project_type: 'interior',
        project_name: '',
        start_date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        duration_days: 1,
        end_time: '18:00',
        admin_notes: 'Assigned directly by Admin',
        sub_tasks: [{ title: '', start_date: new Date().toISOString().split('T')[0], duration_days: 1 }] as SubTaskForm[]
    });

    // Review Modal state (Rejecting / Reviewing notes)
    const [reviewingTask, setReviewingTask] = useState<any | null>(null);
    const [reviewAction, setReviewAction] = useState<'accept' | 'reject' | 'approve_completion' | 'reject_completion'>('accept');
    const [reviewNotes, setReviewNotes] = useState<string>('');
    const [showReviewModal, setShowReviewModal] = useState(false);

    useEffect(() => {
        fetchEmployees();
        fetchTasks();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/users`);
            if (res.data.success) {
                setEmployees(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch employees', err);
        }
    };

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

    // 1. Base Filter Logic (WITHOUT statusFilterTab) so stats stay accurate across all tabs
    const baseTasks = useMemo(() => {
        return tasks.filter(task => {
            // 1. Employee Filter
            if (selectedEmployeeId !== 'all' && String(task.user_id) !== String(selectedEmployeeId)) {
                return false;
            }

            // 2. Project Type Filter
            if (projectTypeFilter !== 'all') {
                const tProj = String(task.project_type || '').toLowerCase();
                if (projectTypeFilter === 'furniture' && !tProj.includes('furniture')) return false;
                if (projectTypeFilter === 'interior' && !tProj.includes('interior')) return false;
            }

            // 3. Statement Period (Date Filtering)
            if (statementPeriod !== 'all_time') {
                const rawDate = task.created_at || task.start_date;
                if (!rawDate) return false;

                let tDate: Date;
                if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate).trim())) {
                    const [y, m, d] = String(rawDate).split('-').map(Number);
                    tDate = new Date(y, m - 1, d, 0, 0, 0, 0);
                } else {
                    tDate = new Date(rawDate);
                }

                if (isNaN(tDate.getTime())) return false;

                const now = new Date();

                if (statementPeriod === 'last_month') {
                    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                    if (tDate < firstOfLastMonth || tDate > lastOfLastMonth) return false;
                } else if (statementPeriod === 'last_3_months') {
                    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    if (tDate < threeMonthsAgo) return false;
                } else if (statementPeriod === 'last_6_months') {
                    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                    if (tDate < sixMonthsAgo) return false;
                } else if (statementPeriod === 'this_year') {
                    const startOfYear = new Date(now.getFullYear(), 0, 1);
                    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                    if (tDate < startOfYear || tDate > endOfYear) return false;
                } else if (statementPeriod === 'by_year') {
                    const yr = selectedYear || now.getFullYear();
                    const startOfYear = new Date(yr, 0, 1);
                    const endOfYear = new Date(yr, 11, 31, 23, 59, 59);
                    if (tDate < startOfYear || tDate > endOfYear) return false;
                } else if (statementPeriod === 'custom_range') {
                    if (customStartDate) {
                        const [sy, sm, sd] = customStartDate.split('-').map(Number);
                        const cStart = new Date(sy, sm - 1, sd, 0, 0, 0);
                        if (tDate < cStart) return false;
                    }
                    if (customEndDate) {
                        const [ey, em, ed] = customEndDate.split('-').map(Number);
                        const cEnd = new Date(ey, em - 1, ed, 23, 59, 59);
                        if (tDate > cEnd) return false;
                    }
                }
            }

            // 4. Search Query Filter
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const titleMatch = String(task.task_title || '').toLowerCase().includes(q);
                const descMatch = String(task.description || '').toLowerCase().includes(q);
                const empMatch = String(task.employee_name || task.employee_fullname || '').toLowerCase().includes(q);
                const projMatch = String(task.project_name || '').toLowerCase().includes(q);
                const typeMatch = String(task.task_type || task.completion_type || '').toLowerCase().includes(q);
                if (!titleMatch && !descMatch && !empMatch && !projMatch && !typeMatch) return false;
            }

            return true;
        });
    }, [tasks, selectedEmployeeId, projectTypeFilter, statementPeriod, selectedYear, customStartDate, customEndDate, searchQuery]);

    // Tasks specifically awaiting admin action (Accept / Reject)
    const awaitingApprovalTasks = useMemo(() => {
        return baseTasks.filter(t => t.status === 'pending_admin_review' || t.status === 'pending_completion_review');
    }, [baseTasks]);

    // 2. Filter Logic applying Status Tab
    const filteredTasks = useMemo(() => {
        return baseTasks.filter(task => {
            if (statusFilterTab === 'pending') {
                if (task.status !== 'pending_admin_review' && task.status !== 'pending_completion_review') return false;
            } else if (statusFilterTab === 'ongoing') {
                if (task.status !== 'ongoing' && task.status !== 'accepted') return false;
            } else if (statusFilterTab === 'completed') {
                if (task.status !== 'completed') return false;
            } else if (statusFilterTab === 'rejected') {
                if (task.status !== 'rejected') return false;
            }
            return true;
        });
    }, [baseTasks, statusFilterTab]);

    // Card Stats calculation based on baseTasks (consistent across all tabs)
    const cardStats = useMemo(() => {
        const completedCount = baseTasks.filter(t => t.status === 'completed').length;
        const pendingCount = baseTasks.filter(t => t.status === 'pending_admin_review' || t.status === 'pending_completion_review').length;
        const ongoingCount = baseTasks.filter(t => t.status === 'ongoing' || t.status === 'accepted').length;
        const approvedCount = baseTasks.filter(t => t.status === 'accepted' || t.status === 'ongoing' || t.status === 'completed').length;
        const rejectedCount = baseTasks.filter(t => t.status === 'rejected').length;

        // Unique employees who have tasks in the filtered list
        const uniqueEmployees = new Set(baseTasks.map(t => t.user_id)).size;
        const totalEmployeeCount = employees.length > 0 ? employees.length : uniqueEmployees;

        return {
            completed: completedCount,
            noOfEmployees: totalEmployeeCount,
            pending: pendingCount,
            ongoing: ongoingCount,
            approved: approvedCount,
            rejected: rejectedCount,
            total: baseTasks.length
        };
    }, [baseTasks, employees]);

    const handleOpenAssignModal = () => {
        setAssignForm({
            user_id: employees.length > 0 ? String(employees[0].user_id) : '',
            task_title: '',
            description: '',
            project_type: 'interior',
            project_name: '',
            start_date: new Date().toISOString().split('T')[0],
            start_time: '',
            duration_days: 1,
            end_time: '',
            admin_notes: 'Assigned directly by Admin',
            sub_tasks: [{ title: '', start_date: new Date().toISOString().split('T')[0], duration_days: 1 }]
        });
        setShowAssignModal(true);
    };

    const handleAddSubTaskField = () => {
        setAssignForm(prev => ({
            ...prev,
            sub_tasks: [...prev.sub_tasks, { title: '', start_date: prev.start_date, duration_days: 1 }]
        }));
    };

    const handleRemoveSubTaskField = (index: number) => {
        setAssignForm(prev => ({
            ...prev,
            sub_tasks: prev.sub_tasks.filter((_, i) => i !== index)
        }));
    };

    const handleAssignTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.user_id || !assignForm.task_title.trim()) {
            alert('Please select an employee and enter a task title.');
            return;
        }

        const selectedEmp = employees.find(e => String(e.user_id) === String(assignForm.user_id));

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/assign`, {
                user_id: assignForm.user_id,
                employee_name: selectedEmp ? (selectedEmp.name || selectedEmp.username) : 'Employee',
                role: selectedEmp ? selectedEmp.role : 'employee',
                task_title: assignForm.task_title.trim(),
                description: assignForm.description,
                project_type: assignForm.project_type,
                project_name: assignForm.project_name,
                start_date: assignForm.start_date,
                start_time: assignForm.start_time,
                duration_days: assignForm.duration_days,
                end_time: assignForm.end_time,
                admin_notes: assignForm.admin_notes,
                sub_tasks: assignForm.sub_tasks.filter(s => s.title.trim() !== '')
            });

            if (res.data.success) {
                alert('Task assigned successfully to the employee!');
                setShowAssignModal(false);
                fetchTasks();
            } else {
                alert('Failed to assign task: ' + res.data.message);
            }
        } catch (err: any) {
            alert('Failed to assign task. ' + (err.response?.data?.message || ''));
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenReviewModal = (task: any, action: 'accept' | 'reject' | 'approve_completion' | 'reject_completion') => {
        setReviewingTask(task);
        setReviewAction(action);
        setReviewNotes('');
        setShowReviewModal(true);
    };

    const handleConfirmReview = async () => {
        if (!reviewingTask) return;
        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/review`, {
                id: reviewingTask.id,
                action: reviewAction,
                notes: reviewNotes.trim()
            });

            if (res.data.success) {
                alert('Task updated successfully!');
                setShowReviewModal(false);
                setReviewingTask(null);
                fetchTasks();
            } else {
                alert('Failed: ' + res.data.message);
            }
        } catch (err: any) {
            alert('Error updating task review.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending_admin_review':
                return <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Pending Approval</span>;
            case 'accepted':
            case 'ongoing':
                return <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> In Progress</span>;
            case 'pending_completion_review':
                return <span style={{ backgroundColor: '#fefce8', color: '#a16207', border: '1px solid #fef9c3', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Completion Requested</span>;
            case 'completed':
                return <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #dcfce7', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Completed</span>;
            case 'rejected':
                return <span style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fee2e2', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> Rejected</span>;
            default:
                return <span style={{ backgroundColor: '#f3f4f6', color: '#4b5563', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>{status}</span>;
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img src={liveLogo} alt="Livincart Logo" style={{ height: '42px', objectFit: 'contain' }} />
                    <div style={{ width: '1.5px', height: '36px', backgroundColor: '#fed7aa' }} />
                    <div>
                        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CheckSquare style={{ color: '#ea580c' }} size={28} />
                            Employee Tasks Management
                        </h1>
                        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                            Assign tasks to employees, review submissions, track project completion & filter period statements
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleOpenAssignModal}
                    style={{
                        backgroundColor: '#ea580c',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 18px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)',
                        transition: 'all 0.2s'
                    }}
                >
                    <Plus size={18} />
                    Assign Task to Employee
                </button>
            </div>

            {/* 5 OVERVIEW SUMMARY CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Card 1: Total Tasks */}
                <div
                    onClick={() => setStatusFilterTab('all')}
                    style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                >
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Layers size={26} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.80rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tasks</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{cardStats.total}</div>
                    </div>
                </div>

                {/* Card 2: Pending Approval */}
                <div
                    onClick={() => setStatusFilterTab('pending')}
                    style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #fed7aa', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                >
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={26} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.80rem', color: '#c2410c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Approval</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ea580c', lineHeight: 1.2 }}>{cardStats.pending}</div>
                    </div>
                </div>

                {/* Card 3: In Progress Tasks */}
                <div
                    onClick={() => setStatusFilterTab('ongoing')}
                    style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                >
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={26} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.80rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Progress</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', lineHeight: 1.2 }}>{cardStats.ongoing}</div>
                    </div>
                </div>

                {/* Card 4: Task Completed */}
                <div
                    onClick={() => setStatusFilterTab('completed')}
                    style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                >
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={26} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.80rem', color: '#15803d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completed</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a', lineHeight: 1.2 }}>{cardStats.completed}</div>
                    </div>
                </div>

                {/* Card 5: No. of Employees */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={26} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.80rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>No. of Employees</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{cardStats.noOfEmployees}</div>
                    </div>
                </div>
            </div>

            {/* FILTERS TOOLBAR PANEL */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 700, fontSize: '0.90rem' }}>
                        <Filter size={18} style={{ color: '#ea580c' }} />
                        Filter &amp; Search Tasks
                    </div>
                    <button
                        onClick={() => {
                            setSearchQuery('');
                            setStatementPeriod('all_time');
                            setSelectedYear(new Date().getFullYear());
                            setProjectTypeFilter('all');
                            setSelectedEmployeeId('all');
                            setStatusFilterTab('all');
                            setCustomStartDate('');
                            setCustomEndDate('');
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #ef4444',
                            backgroundColor: '#fef2f2',
                            color: '#ef4444',
                            fontWeight: 800,
                            fontSize: '0.80rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)'
                        }}
                        title="Reset all task search and filter options"
                    >
                        <RotateCcw size={14} /> Reset Filters
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
                    {/* Search Bar */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Search Task / Employee / Project</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search keyword..."
                                style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none' }}
                            />
                        </div>
                    </div>

                    {/* Statement Period Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Statement Period</label>
                        <select
                            value={statementPeriod}
                            onChange={(e) => setStatementPeriod(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all_time">All Time</option>
                            <option value="last_month">Last Month</option>
                            <option value="last_3_months">Last 3 Months</option>
                            <option value="last_6_months">Last 6 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="by_year">By Year</option>
                            <option value="custom_range">Custom Range</option>
                        </select>
                    </div>

                    {/* By Year — Dynamic Year Picker */}
                    {statementPeriod === 'by_year' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Select Year</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #2563eb', fontSize: '0.84rem', outline: 'none', backgroundColor: '#eff6ff', fontWeight: 800, color: '#1e40af', cursor: 'pointer' }}
                            >
                                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(yr => (
                                    <option key={yr} value={yr}>{yr}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Project Type Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Project Type</label>
                        <select
                            value={projectTypeFilter}
                            onChange={(e) => setProjectTypeFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all">All Project Types</option>
                            <option value="furniture">Furniture Projects</option>
                            <option value="interior">Interior Projects</option>
                        </select>
                    </div>

                    {/* Employee Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Filter by Employee</label>
                        <select
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all">All Employees</option>
                            {employees.map(emp => (
                                <option key={emp.user_id} value={emp.user_id}>
                                    {emp.name || emp.username} ({emp.role})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Custom Date Range Picker if Custom Range selected */}
                {statementPeriod === 'custom_range' && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>From Date:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>To Date:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* DEDICATED ADMIN ACCEPT & REJECT OPTIONS TABLE */}
            {awaitingApprovalTasks.length > 0 && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1.5px solid #f97316', overflow: 'hidden', boxShadow: '0 4px 16px rgba(249, 115, 22, 0.12)', marginBottom: '24px' }}>
                    <div style={{ padding: '16px 20px', backgroundColor: '#fff7ed', borderBottom: '1.5px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ea580c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)' }}>
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#9a3412' }}>
                                        Accept &amp; Reject Pending Tasks Table
                                    </h3>
                                    <span style={{ backgroundColor: '#ea580c', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800, padding: '2px 9px', borderRadius: '10px' }}>
                                        {awaitingApprovalTasks.length} Awaiting Action
                                    </span>
                                </div>
                                <p style={{ margin: '3px 0 0 0', fontSize: '0.80rem', color: '#c2410c' }}>
                                    Directly review, accept, or reject employee task proposals and completion submissions below
                                </p>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#9a3412', backgroundColor: '#fed7aa', padding: '6px 12px', borderRadius: '8px' }}>
                            ⚡ Immediate Admin Action Required
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fed7aa', color: '#9a3412', fontWeight: 700 }}>
                                    <th style={{ padding: '12px 16px', width: '45px' }}>#</th>
                                    <th style={{ padding: '12px 16px' }}>Task Title &amp; Project</th>
                                    <th style={{ padding: '12px 16px' }}>Employee</th>
                                    <th style={{ padding: '12px 16px' }}>Review Stage</th>
                                    <th style={{ padding: '12px 16px' }}>Type &amp; Description / Deliverable</th>
                                    <th style={{ padding: '12px 16px' }}>Dates &amp; Duration</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', minWidth: '220px' }}>Review Options</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awaitingApprovalTasks.map((t, idx) => (
                                    <tr key={`awaiting-admin-${t.id}`} style={{ borderBottom: '1px solid #fed7aa', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fffdfa' }}>
                                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#9a3412' }}>{idx + 1}</td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{t.task_title}</div>
                                            {t.project_name && (
                                                <div style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 700, marginTop: '2px' }}>
                                                    📁 Project: {t.project_name}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{t.employee_fullname || t.employee_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{t.role || 'Employee'}</div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            {t.status === 'pending_admin_review' ? (
                                                <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', padding: '4px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} /> New Task Request
                                                </span>
                                            ) : (
                                                <span style={{ backgroundColor: '#fefce8', color: '#a16207', border: '1px solid #fef9c3', padding: '4px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertTriangle size={12} /> Completion Review
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px', maxWidth: '320px' }}>
                                            {t.task_type && (
                                                <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-block', marginBottom: '4px' }}>
                                                    Type: {t.task_type}
                                                </span>
                                            )}
                                            {t.description && (
                                                <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.35 }}>
                                                    {t.description}
                                                </div>
                                            )}
                                            {t.completion_type && (
                                                <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#16a34a', fontWeight: 700 }}>
                                                    🎯 Deliverable: {t.completion_type}
                                                </div>
                                            )}
                                            {t.completion_notes && (
                                                <div style={{ fontSize: '0.76rem', color: '#475569', fontStyle: 'italic', marginTop: '2px', backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '4px' }}>
                                                    "{t.completion_notes}"
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontSize: '0.80rem', fontWeight: 600, color: '#334155' }}>
                                                {t.start_date || 'N/A'} {t.end_date ? `to ${t.end_date}` : ''}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                                                Duration: {t.duration_days || 1} day(s)
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                {t.status === 'pending_admin_review' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'accept')}
                                                            title="Accept this proposed task"
                                                            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', padding: '7px 14px', borderRadius: '7px', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)' }}
                                                        >
                                                            <Check size={15} /> Accept Task
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'reject')}
                                                            title="Reject this proposed task"
                                                            style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', padding: '7px 14px', borderRadius: '7px', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)' }}
                                                        >
                                                            <X size={15} /> Reject Task
                                                        </button>
                                                    </>
                                                )}
                                                {t.status === 'pending_completion_review' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'approve_completion')}
                                                            title="Approve task completion"
                                                            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', padding: '7px 14px', borderRadius: '7px', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)' }}
                                                        >
                                                            <Check size={15} /> Approve Done
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'reject_completion')}
                                                            title="Reject task completion and send back"
                                                            style={{ backgroundColor: '#ea580c', color: '#ffffff', border: 'none', padding: '7px 14px', borderRadius: '7px', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)' }}
                                                        >
                                                            <X size={15} /> Reject Done
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* STATUS TABS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                {[
                    { id: 'all', label: `All Tasks (${cardStats.total})` },
                    { id: 'pending', label: `Pending Approval (${cardStats.pending})` },
                    { id: 'ongoing', label: `In Progress (${cardStats.ongoing})` },
                    { id: 'completed', label: `Completed (${cardStats.completed})` },
                    { id: 'rejected', label: `Rejected (${cardStats.rejected})` }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilterTab(tab.id)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: statusFilterTab === tab.id
                                ? (tab.id === 'pending' ? '#ea580c' : tab.id === 'ongoing' ? '#2563eb' : '#0f172a')
                                : '#ffffff',
                            color: statusFilterTab === tab.id ? '#ffffff' : '#64748b',
                            boxShadow: statusFilterTab === tab.id ? '0 2px 8px rgba(15,23,42,0.15)' : 'none',
                            borderWidth: statusFilterTab === tab.id ? '0' : '1px',
                            borderStyle: 'solid',
                            borderColor: '#e2e8f0',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TASKS TABLE / LIST */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        Loading employee tasks...
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                        <CheckSquare size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>No Tasks Found</div>
                        <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '4px' }}>Try adjusting your filters or assign a new task to an employee</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                                    <th style={{ padding: '12px 16px', width: '50px' }}>#</th>
                                    <th style={{ padding: '12px 16px' }}>Task Title &amp; Project</th>
                                    <th style={{ padding: '12px 16px', minWidth: '220px' }}>Task Description &amp; Details</th>
                                    <th style={{ padding: '12px 16px' }}>Assigned Employee</th>
                                    <th style={{ padding: '12px 16px' }}>Project Type</th>
                                    <th style={{ padding: '12px 16px' }}>Duration &amp; Dates</th>
                                    <th style={{ padding: '12px 16px' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.map((t, index) => (
                                    <tr key={t.id} style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        backgroundColor: (t.status === 'pending_admin_review' || t.status === 'pending_completion_review') ? '#fffdfa' : index % 2 === 0 ? '#ffffff' : '#fafafa',
                                        borderLeft: (t.status === 'pending_admin_review' || t.status === 'pending_completion_review') ? '4px solid #ea580c' : 'none'
                                    }}>
                                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#64748b' }}>{index + 1}</td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.90rem' }}>{t.task_title}</div>
                                            {t.project_name && (
                                                <div style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 700, marginTop: '2px' }}>
                                                    📁 Project: {t.project_name}
                                                </div>
                                            )}
                                            {t.sub_tasks && t.sub_tasks.length > 0 && (
                                                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#475569', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                                                    📋 {t.sub_tasks.length} Sub-tasks ({t.sub_tasks.filter((st: any) => st.status === 'completed').length} done)
                                                </div>
                                            )}
                                        </td>
                                        {/* SEPARATE COLUMN FOR TASK DESCRIPTION & DETAILS */}
                                        <td style={{ padding: '14px 16px', minWidth: '220px', maxWidth: '340px' }}>
                                            {t.task_type && (
                                                <span style={{
                                                    backgroundColor: '#eff6ff',
                                                    color: '#1d4ed8',
                                                    border: '1px solid #dbeafe',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    display: 'inline-block',
                                                    marginBottom: '5px'
                                                }}>
                                                    Type: {t.task_type}
                                                </span>
                                            )}
                                            {t.description ? (
                                                <div style={{
                                                    fontSize: '0.82rem',
                                                    color: '#334155',
                                                    lineHeight: 1.45,
                                                    whiteSpace: 'pre-line',
                                                    wordBreak: 'break-word',
                                                    maxHeight: '130px',
                                                    overflowY: 'auto'
                                                }}>
                                                    {t.description}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                    No description provided
                                                </span>
                                            )}
                                            {t.completion_type && (
                                                <div style={{ marginTop: '6px', fontSize: '0.76rem', color: '#16a34a', fontWeight: 700 }}>
                                                    🎯 Deliverable: {t.completion_type}
                                                </div>
                                            )}
                                            {t.completion_notes && (
                                                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#475569', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                    "{t.completion_notes}"
                                                </div>
                                            )}
                                            {t.admin_notes && (
                                                <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#6b21a8', backgroundColor: '#faf5ff', padding: '3px 6px', borderRadius: '4px', border: '1px solid #f3e8ff' }}>
                                                    <strong>Admin Note:</strong> {t.admin_notes}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{t.employee_fullname || t.employee_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{t.role || 'Employee'}</div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                backgroundColor: String(t.project_type).toLowerCase().includes('furniture') ? '#fef3c7' : '#e0e7ff',
                                                color: String(t.project_type).toLowerCase().includes('furniture') ? '#b45309' : '#4338ca',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.74rem',
                                                fontWeight: 700,
                                                textTransform: 'capitalize'
                                            }}>
                                                {t.project_type ? (t.project_type.includes('furniture') ? 'Furniture Project' : 'Interior Project') : 'Interior Project'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontSize: '0.80rem', fontWeight: 600, color: '#334155' }}>
                                                {t.start_date || 'N/A'} {t.start_time ? `(${t.start_time})` : ''} {t.end_date ? `to ${t.end_date}` : ''} {t.end_time ? `(${t.end_time})` : ''}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                                                Duration: {t.duration_days || 1} day(s) {t.start_time && t.end_time ? `• Time: ${t.start_time} - ${t.end_time}` : ''}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            {getStatusBadge(t.status)}
                                            {t.rejection_reason && (
                                                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px', fontWeight: 600 }}>
                                                    Reason: {t.rejection_reason}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                {/* Task Approval Actions */}
                                                {t.status === 'pending_admin_review' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'accept')}
                                                            style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <Check size={14} /> Accept
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'reject')}
                                                            style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <X size={14} /> Reject
                                                        </button>
                                                    </>
                                                )}

                                                {/* Completion Review Actions */}
                                                {t.status === 'pending_completion_review' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'approve_completion')}
                                                            style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <Check size={14} /> Approve Done
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenReviewModal(t, 'reject_completion')}
                                                            style={{ backgroundColor: '#ea580c', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <X size={14} /> Reject Done
                                                        </button>
                                                    </>
                                                )}

                                                {t.status === 'completed' && (
                                                    <span style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <CheckCircle2 size={14} /> Approved & Done
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ASSIGN TASK MODAL FOR ADMIN */}
            {showAssignModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                    <div className="modal-box" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '650px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff', borderRadius: '16px 16px 0 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src={liveLogo} alt="Logo" style={{ height: '32px', objectFit: 'contain' }} />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Plus style={{ color: '#ea580c' }} /> Assign Task to Employee
                                </h2>
                            </div>
                            <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '24px' }}>
                            <form onSubmit={handleAssignTaskSubmit}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    {/* Employee Select */}
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Select Employee *</label>
                                        <select
                                            value={assignForm.user_id}
                                            onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                                            required
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }}
                                        >
                                            <option value="">-- Choose Employee --</option>
                                            {employees.map(emp => (
                                                <option key={emp.user_id} value={emp.user_id}>
                                                    {emp.name || emp.username} ({emp.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Task Title */}
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Task Title *</label>
                                        <input
                                            type="text"
                                            value={assignForm.task_title}
                                            onChange={(e) => setAssignForm({ ...assignForm, task_title: e.target.value })}
                                            placeholder="e.g. Complete Modular Kitchen 3D Design or Site Inspection"
                                            required
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* Project Type */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Project Type</label>
                                        <select
                                            value={assignForm.project_type}
                                            onChange={(e) => setAssignForm({ ...assignForm, project_type: e.target.value })}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }}
                                        >
                                            <option value="interior">Interior Projects</option>
                                            <option value="furniture">Furniture Projects</option>
                                        </select>
                                    </div>

                                    {/* Project Name */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Project Name / Client</label>
                                        <input
                                            type="text"
                                            value={assignForm.project_name}
                                            onChange={(e) => setAssignForm({ ...assignForm, project_name: e.target.value })}
                                            placeholder="e.g. Prestige Villa 402"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* Start Date */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Start Date *</label>
                                        <input
                                            type="date"
                                            value={assignForm.start_date}
                                            onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* Start Time */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Start Time *</label>
                                        <input
                                            type="time"
                                            value={assignForm.start_time}
                                            onChange={(e) => setAssignForm({ ...assignForm, start_time: e.target.value })}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* Duration Days */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Duration (Days)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={assignForm.duration_days}
                                            onChange={(e) => setAssignForm({ ...assignForm, duration_days: parseInt(e.target.value) || 1 })}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* End Time */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>End Time / Deadline *</label>
                                        <input
                                            type="time"
                                            value={assignForm.end_time}
                                            onChange={(e) => setAssignForm({ ...assignForm, end_time: e.target.value })}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Task Instructions & Details</label>
                                        <textarea
                                            rows={3}
                                            value={assignForm.description}
                                            onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                                            placeholder="Detailed instructions for the employee..."
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* Sub-tasks list */}
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '0.80rem', fontWeight: 700, color: '#334155' }}>Sub-tasks / Milestones</label>
                                            <button
                                                type="button"
                                                onClick={handleAddSubTaskField}
                                                style={{ backgroundColor: '#f1f5f9', color: '#ea580c', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                + Add Sub-task
                                            </button>
                                        </div>
                                        {assignForm.sub_tasks.map((st, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    placeholder={`Sub-task ${idx + 1} title`}
                                                    value={st.title}
                                                    onChange={(e) => {
                                                        const updated = [...assignForm.sub_tasks];
                                                        updated[idx].title = e.target.value;
                                                        setAssignForm({ ...assignForm, sub_tasks: updated });
                                                    }}
                                                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                                                />
                                                {assignForm.sub_tasks.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveSubTaskField(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowAssignModal(false)}
                                        style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)' }}
                                    >
                                        {submitting ? 'Assigning...' : 'Assign Task'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* REVIEW / REJECT MODAL */}
            {showReviewModal && reviewingTask && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                Confirm Action: {reviewAction === 'accept' ? 'Accept Task Request' : reviewAction === 'reject' ? 'Reject Task Request' : reviewAction === 'approve_completion' ? 'Approve Task Completion' : 'Reject Completion Request'}
                            </h3>
                            <button onClick={() => setShowReviewModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '16px', fontSize: '0.86rem', color: '#475569', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{reviewingTask.task_title}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Assigned to: {reviewingTask.employee_name}</div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                {reviewAction.includes('reject') ? 'Rejection Reason / Required Changes *' : 'Admin Notes (Optional)'}
                            </label>
                            <textarea
                                rows={3}
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder={reviewAction.includes('reject') ? 'Explain why this task request is rejected...' : 'Add notes for the employee...'}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setShowReviewModal(false)}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReview}
                                disabled={submitting}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: reviewAction.includes('reject') ? '#dc2626' : '#16a34a',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {submitting ? 'Processing...' : 'Confirm Action'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
