import React from 'react';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    CreditCard,
    FileText,
    Truck,
    HardHat,
    ShoppingCart,
    LogOut,
    Menu,
    X,
    Target,
    Wallet,
    Headphones,
    ChevronLeft,
    ChevronRight,
    Building2,
    TrendingUp,
    Palette,
    CheckSquare,
    Clock,
    BarChart3,
    Receipt,
    HelpCircle,
    Send,
    CheckCircle2,
    AlertCircle,
    Loader2,
    MessageSquare,
    CheckCheck
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import liveLogo from '../assets/live-logo.png';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    // Close notifications dropdown when clicking anywhere outside on the screen
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowNotifications(false);
            }
        };

        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showNotifications]);

    // Help & Feedback Modal State
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [helpTab, setHelpTab] = useState<'new' | 'history'>('new');
    const [helpCategory, setHelpCategory] = useState<'query' | 'feedback' | 'issue' | 'urgent' | 'other'>('query');
    const [helpSubject, setHelpSubject] = useState('');
    const [helpMessage, setHelpMessage] = useState('');
    const [helpSubmitting, setHelpSubmitting] = useState(false);
    const [helpSuccess, setHelpSuccess] = useState(false);
    const [helpError, setHelpError] = useState('');
    const [supportQueries, setSupportQueries] = useState<any[]>([]);
    const [supportLoading, setSupportLoading] = useState(false);
    const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'answered'>('all');
    const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});
    const [replySubmittingMap, setReplySubmittingMap] = useState<Record<number, boolean>>({});
    const [rolePermissions, setRolePermissions] = useState<Record<string, string[]> | null>(() => {
        try {
            const cached = localStorage.getItem('livrcart_role_permissions');
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    });

    useEffect(() => {
        const fetchRolePermissions = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/role-permissions`);
                if (res.data?.success && res.data?.data) {
                    setRolePermissions(res.data.data);
                    localStorage.setItem('livrcart_role_permissions', JSON.stringify(res.data.data));
                }
            } catch (err) {
                // Ignore silently, fallback to defaults
            }
        };

        fetchRolePermissions();

        const handlePermUpdated = () => {
            try {
                const cached = localStorage.getItem('livrcart_role_permissions');
                if (cached) {
                    setRolePermissions(JSON.parse(cached));
                } else {
                    fetchRolePermissions();
                }
            } catch (e) {
                fetchRolePermissions();
            }
        };

        window.addEventListener('livrcart_role_permissions_updated', handlePermUpdated);
        return () => window.removeEventListener('livrcart_role_permissions_updated', handlePermUpdated);
    }, []);

    const userRoleStr = String(user?.role || '').toLowerCase();
    const userIsAdmin = userRoleStr.includes('admin') || userRoleStr === 'super_admin' || userRoleStr === 'administrator';

    useEffect(() => {
        if (user) {
            fetchNotifications();
            fetchSupportQueries();
            const interval = setInterval(() => {
                fetchNotifications();
                fetchSupportQueries();
            }, 15000); // poll every 15s
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/notifications?user_id=${user?.user_id}`);
            if (res.data.success) {
                setNotifications(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        }
    };

    const fetchSupportQueries = async () => {
        if (!user) return;
        setSupportLoading(true);
        try {
            const uid = user?.user_id || (user as any)?.id;
            const res = await axios.get(`${API_BASE_URL}/notifications/support-queries?user_id=${uid}&role=${user?.role}`);
            if (res.data?.success && Array.isArray(res.data.data)) {
                setSupportQueries(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch support queries', err);
        } finally {
            setSupportLoading(false);
        }
    };

    const openHelpModal = (tab: 'new' | 'history' = 'new') => {
        setShowHelpModal(true);
        setHelpTab(tab);
        setHelpSuccess(false);
        setHelpError('');
        fetchSupportQueries();
    };

    const handleSendAdminReply = async (queryId: number) => {
        const replyText = (replyTextMap[queryId] || '').trim();
        if (!replyText) return;
        setReplySubmittingMap(prev => ({ ...prev, [queryId]: true }));
        try {
            const payload = {
                query_id: queryId,
                admin_reply: replyText,
                admin_id: user?.user_id || (user as any)?.id,
                admin_name: user?.name || 'Admin Team'
            };
            const res = await axios.post(`${API_BASE_URL}/notifications/reply-support-query`, payload);
            if (res.data?.success) {
                setSupportQueries(prev => prev.map(q => {
                    if (q.id === queryId) {
                        return {
                            ...q,
                            admin_reply: replyText,
                            admin_name: user?.name || 'Admin Team',
                            replied_at: new Date().toISOString(),
                            status: 'answered'
                        };
                    }
                    return q;
                }));
                setReplyTextMap(prev => ({ ...prev, [queryId]: '' }));
            }
        } catch (err) {
            console.error('Failed to send admin reply', err);
        } finally {
            setReplySubmittingMap(prev => ({ ...prev, [queryId]: false }));
        }
    };

    const handleReadNotification = async (id: number, notif?: any) => {
        try {
            await axios.post(`${API_BASE_URL}/notifications/read`, { notification_id: id });
            setNotifications(prev => prev.filter(n => n.id !== id));
            setShowNotifications(false);
            if (notif && (String(notif.title).toLowerCase().includes('help') || String(notif.title).toLowerCase().includes('query') || String(notif.type || '').includes('support'))) {
                openHelpModal('history');
            } else if (notif && (String(notif.title).toLowerCase().includes('vendor') || String(notif.message).toLowerCase().includes('vendor') || String(notif.type || '').includes('vendor'))) {
                navigate('/vendor-quota');
            } else if (notif && (String(notif.title).toLowerCase().includes('timeline') || String(notif.message).toLowerCase().includes('timeline') || String(notif.title).toLowerCase().includes('approval'))) {
                navigate('/project-timelines');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSubmitHelp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!helpMessage.trim()) {
            setHelpError('Please enter your query or feedback message.');
            return;
        }
        setHelpSubmitting(true);
        setHelpError('');
        try {
            const payload = {
                user_id: user?.user_id || (user as any)?.id,
                user_name: user?.name || 'Staff Member',
                user_role: user?.role || 'Staff',
                query_type: helpCategory,
                subject: helpSubject.trim() || `${helpCategory.toUpperCase()} from ${user?.name || 'User'}`,
                message: helpMessage.trim()
            };
            const res = await axios.post(`${API_BASE_URL}/notifications/submit-help`, payload);
            if (res.data?.success) {
                setHelpSuccess(true);
                fetchSupportQueries();
            } else {
                setHelpError(res.data?.message || 'Failed to submit query. Please try again.');
            }
        } catch (err: any) {
            setHelpError(err.response?.data?.message || 'Error communicating with server.');
        } finally {
            setHelpSubmitting(false);
        }
    };

    const allMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/overview', roles: ['admin'] },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/pm-dashboard', roles: ['project_manager'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/manager-dashboard', roles: ['manager'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/accountant-dashboard', roles: ['accountant'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/designer-dashboard', roles: ['associate_designer'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/marketing-dashboard', roles: ['marketing_analyst'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/mmt-dashboard', roles: ['mmt'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/site-dashboard', roles: ['site_engineer', 'site_inspection', 'site_inspector'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/d1-dashboard', roles: ['d1', 'd2'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/mb-dashboard', roles: ['business_associate'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['sales'], excludeAdmin: true },
        { icon: Clock, label: 'Livincart Project Timelines', path: '/project-timelines', roles: ['admin', 'manager', 'project_manager', 'project_head'] },
        { icon: TrendingUp, label: 'Analysis', path: '/analysis', roles: [], excludeAdmin: true },
        { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['admin', 'sales', 'manager', 'business_associate', 'accountant'] },
        { icon: Target, label: 'D1 / D2 Leads', path: '/d1-leads', roles: ['d1', 'd2', 'associate_designer', 'admin', 'manager', 'sales'] },
        { icon: Target, label: 'Leads', path: '/leads', roles: ['admin', 'sales', 'manager'] },
        { icon: Target, label: 'MMT Leads', path: '/mmt-leads', roles: ['mmt'], excludeAdmin: true },
        { icon: Target, label: 'Site Leads', path: '/site-leads', roles: ['site_engineer', 'site_inspection', 'site_inspector'], excludeAdmin: true },
        { icon: CheckSquare, label: 'Tasks & Employee Management', path: '/mb-tasks', roles: ['admin', 'sales', 'business_associate', 'project_manager', 'manager', 'd1', 'd2', 'associate_designer', 'marketing_analyst', 'mmt', 'project_head', 'site_engineer', 'graphic_designer', 'gd'] },
        { icon: Users, label: 'Clients', path: '/clients', roles: ['admin', 'project_manager', 'accountant', 'project_head', 'sales', 'manager', 'd1', 'd2', 'associate_designer'] },
        { icon: Briefcase, label: 'Projects', path: '/projects', roles: ['admin', 'project_manager', 'accountant', 'project_head', 'site_engineer', 'manager', 'd1', 'd2', 'associate_designer', 'site_inspection', 'site_inspector', 'mmt', 'sales'] },
        // { icon: HardHat, label: 'Contractors', path: '/vendors', roles: ['admin', 'project_manager', 'manager', 'mmt'] }, // Currently hidden as requested. Unhide when requested.
        { icon: ShoppingCart, label: 'Vendors', path: '/global-vendors', roles: ['admin', 'project_manager', 'manager', 'mmt'] },
        { icon: CreditCard, label: 'Finance', path: '/finance', roles: ['accountant', 'admin'] },
        { icon: Wallet, label: 'Financial Overview', path: '/financial-overview', roles: ['admin'] },
        { icon: FileText, label: 'Agreements', path: '/agreements', roles: ['admin', 'accountant', 'sales', 'manager'] },
        { icon: FileText, label: 'Quotes / Estimations', path: '/quotes', roles: ['admin', 'accountant', 'sales', 'manager', 'project_head', 'd1', 'd2', 'associate_designer', 'graphic_designer', 'gd', 'marketing_analyst'] },
        { icon: ShoppingCart, label: 'Vendor Quotation', path: '/vendor-quota', roles: ['admin', 'accountant', 'sales', 'project_manager', 'manager', 'project_head', 'mmt'] },

        { icon: Users, label: 'Team', path: '/team', roles: ['admin', 'manager'] },
        { icon: Building2, label: 'Company Expenses', path: '/company-expenses', roles: ['admin', 'manager'] },
        { icon: Receipt, label: 'Reimbursements', path: '/reimbursements', roles: ['admin', 'sales', 'd1', 'd2', 'project_manager', 'manager', 'project_head', 'accountant', 'graphic_designer', 'gd', 'site_engineer', 'site_inspection', 'site_inspector', 'mmt', 'business_associate', 'associate_designer', 'marketing_analyst'] },
        { icon: Wallet, label: 'Staff Reimbursements', path: '/staff-reimbursements', roles: ['admin', 'manager'] },
    ];

    const menuItems = allMenuItems.filter(item => {
        if (!user) return false;
        const uRole = String(user.role || '').toLowerCase();
        const isGd = uRole.includes('graphic') || uRole === 'gd';
        const roleKey = isGd ? 'graphic_designer' : (uRole === 'site_inspection' ? 'site_inspector' : uRole);

        // Check dynamic role-based page permissions configured by admin
        if (rolePermissions && (rolePermissions[roleKey] || rolePermissions[uRole])) {
            const allowed = rolePermissions[roleKey] || rolePermissions[uRole] || [];
            if (item.label === 'Dashboard' && item.roles.some(r => r.toLowerCase() === uRole || (isGd && (r === 'gd' || r === 'graphic_designer')))) {
                return true;
            }
            return allowed.includes(item.path);
        }

        // Fallback to default hardcoded roles logic if permissions not yet customized
        if ((item as any).excludeAdmin && uRole === 'admin') return false;

        if (uRole === 'admin' && !(item as any).excludeAdmin) return true;

        return item.roles.some(r => {
            const rLower = String(r).toLowerCase();
            if (rLower === uRole) return true;
            if (isGd && (rLower === 'graphic_designer' || rLower === 'gd')) {
                return true;
            }
            return false;
        });
    });

    return (
        <div className="layout-container" style={{ overflowX: 'hidden' }}>
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90 }}
                />
            )}
            <aside
                className={`sidebar sidebar-container ${isSidebarOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                style={{ height: '125vh', position: 'fixed', left: 0, top: 0, color: 'white', display: 'flex', flexDirection: 'column', zIndex: 100 }}
            >
                <div className="sidebar-header" style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={liveLogo} alt="Logo" style={{ height: '36px', objectFit: 'contain', transition: 'all 0.3s' }} />
                        <div className="sidebar-header-text" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: '1.1', color: '#ffffff' }}>Livincart</span>
                            <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#a1a1aa' }}>Project Timelines</span>
                        </div>
                    </div>
                    <button
                        className="no-print desktop-collapse-btn sidebar-header-text"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Pin Sidebar Open" : "Unpin Sidebar"}
                        style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: window.innerWidth <= 1024 ? 'none' : 'block' }}
                    >
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>
                <nav className="sidebar-nav" style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {menuItems.map((item, index) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <li key={index} style={{ marginBottom: '6px' }}>
                                    <Link
                                        to={item.path}
                                        className={`sidebar-link ${isActive ? 'active' : ''}`}
                                        onClick={() => setIsSidebarOpen(false)}
                                    >
                                        <item.icon size={20} className="sidebar-icon" />
                                        <span className="sidebar-text" style={{ fontWeight: isActive ? 700 : 500, fontSize: '0.95rem' }}>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div
                    className="sidebar-help-card"
                    style={{ padding: '16px', marginTop: 'auto' }}
                >
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '14px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.borderColor = 'rgba(37,99,235,0.7)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                    }}
                    >
                        <div
                            onClick={() => openHelpModal(userIsAdmin ? 'history' : 'new')}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                        >
                            <div style={{ backgroundColor: '#2563eb', padding: '8px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Headphones size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                    <p style={{ color: 'white', fontSize: '0.86rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {userIsAdmin ? 'Support Queries' : 'Need Help & Support'}
                                    </p>
                                    {supportQueries.filter(q => !q.admin_reply).length > 0 && userIsAdmin && (
                                        <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px', flexShrink: 0 }}>
                                            {supportQueries.filter(q => !q.admin_reply).length}
                                        </span>
                                    )}
                                </div>
                                <p style={{ color: '#93c5fd', fontSize: '0.74rem', margin: '2px 0 0 0', fontWeight: 500 }}>
                                    {userIsAdmin ? 'Reply to Employee Queries' : 'Write Query & View Replies'}
                                </p>
                            </div>
                        </div>

                        {/* Quick Action Pills in Sidebar Card */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                type="button"
                                onClick={() => openHelpModal('new')}
                                style={{
                                    flex: 1,
                                    padding: '5px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(37,99,235,0.25)',
                                    border: '1px solid rgba(59,130,246,0.4)',
                                    color: '#bfdbfe',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                + New Query
                            </button>
                            <button
                                type="button"
                                onClick={() => openHelpModal('history')}
                                style={{
                                    flex: 1,
                                    padding: '5px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#ffffff',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px'
                                }}
                            >
                                <MessageSquare size={11} /> History
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
            <main className={`main-content ${isCollapsed ? 'collapsed' : ''}`} id="main-layout-content" style={{ flex: 1, backgroundColor: '#f9fafb', minHeight: '100vh', padding: '30px 40px' }}>
                <header className="layout-header no-print" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '30px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            style={{ display: 'none', background: 'none', border: 'none', color: 'black ', cursor: 'pointer' }}
                            className="mobile-menu-btn"
                        >
                            <Menu size={28} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', margin: 0 }}>Livincart Project Timelines</h1>
                            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Livincart Project Timelines <ChevronRight size={14} /> {menuItems.find(i => i.path === location.pathname)?.label || 'Overview'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Need Help Button in Header */}
                        <button
                            type="button"
                            onClick={() => openHelpModal(userIsAdmin ? 'history' : 'new')}
                            title="Need Help? Submit queries or feedback directly to Admin"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                backgroundColor: '#ffffff',
                                border: '1.5px solid #cbd5e1',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                color: '#1e293b',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = '#2563eb';
                                e.currentTarget.style.color = '#2563eb';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = '#cbd5e1';
                                e.currentTarget.style.color = '#1e293b';
                            }}
                        >
                            <HelpCircle size={16} color="#2563eb" />
                            <span>{userIsAdmin ? 'Support Queries' : 'Need Help?'}</span>
                            {supportQueries.filter(q => !q.admin_reply).length > 0 && userIsAdmin && (
                                <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px', marginLeft: '2px' }}>
                                    {supportQueries.filter(q => !q.admin_reply).length}
                                </span>
                            )}
                        </button>

                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: 600, color: '#111827', margin: 0, fontSize: '0.95rem' }}>{user?.name}</p>
                            <p style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'capitalize', margin: 0 }}>{user?.role.replace('_', ' ')}</p>
                        </div>
                        <div style={{
                            width: '45px',
                            height: '45px',
                            borderRadius: '50%',
                            backgroundColor: '#111827',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '1.2rem',
                            textTransform: 'uppercase'
                        }}>
                            {user?.name.charAt(0)}
                        </div>
                        <div ref={notificationRef} style={{ position: 'relative' }}>
                            <div
                                onClick={() => setShowNotifications(!showNotifications)}
                                style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', position: 'relative', backgroundColor: showNotifications ? '#f3f4f6' : 'white' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                {notifications.length > 0 && (
                                    <span style={{ position: 'absolute', top: '8px', right: '10px', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%' }}></span>
                                )}
                            </div>

                            {/* Notifications Dropdown */}
                            {showNotifications && (
                                <div style={{ position: 'absolute', top: '50px', right: '0', width: '320px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', zIndex: 50 }}>
                                    <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>Notifications</h3>
                                        <span style={{ fontSize: '0.75rem', backgroundColor: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{notifications.length} New</span>
                                    </div>
                                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>No new notifications</div>
                                        ) : (
                                            notifications.map(notif => (
                                                <div key={notif.id} style={{ padding: '16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '12px', cursor: 'pointer', transition: 'background-color 0.2s' }} onClick={() => handleReadNotification(notif.id, notif)} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <div style={{ width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%', marginTop: '6px', flexShrink: 0 }}></div>
                                                    <div>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{notif.title}</p>
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{notif.message}</p>
                                                        <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>{new Date(notif.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 600,
                                fontSize: '0.95rem'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
                        >
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                    </div>
                </header>
                {children}

                {/* Need Help & Queries / Feedback Modal */}
                {showHelpModal && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10002,
                        padding: '16px'
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '660px',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                            border: '1px solid #e2e8f0'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                padding: '16px 24px',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: '#f8fafc'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                        <Headphones size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0c1527' }}>Need Help &amp; Support</h3>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                            {userIsAdmin ? 'Review employee queries and submit official admin replies' : 'Ask queries or share feedback with Admin & view reply history'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowHelpModal(false); setHelpSuccess(false); setHelpError(''); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '50%' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Navigation Tabs Bar */}
                            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '0 20px', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setHelpTab('new'); setHelpSuccess(false); }}
                                    style={{
                                        padding: '12px 16px',
                                        border: 'none',
                                        borderBottom: helpTab === 'new' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                                        backgroundColor: 'transparent',
                                        color: helpTab === 'new' ? '#1d4ed8' : '#64748b',
                                        fontWeight: helpTab === 'new' ? 800 : 600,
                                        fontSize: '0.86rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Send size={14} /> Submit Query
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setHelpTab('history'); fetchSupportQueries(); }}
                                    style={{
                                        padding: '12px 16px',
                                        border: 'none',
                                        borderBottom: helpTab === 'history' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                                        backgroundColor: 'transparent',
                                        color: helpTab === 'history' ? '#1d4ed8' : '#64748b',
                                        fontWeight: helpTab === 'history' ? 800 : 600,
                                        fontSize: '0.86rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <MessageSquare size={14} />
                                    <span>{userIsAdmin ? 'Employee Queries & Replies' : 'Query History & Chat'}</span>
                                    {supportQueries.length > 0 && (
                                        <span style={{
                                            backgroundColor: helpTab === 'history' ? '#2563eb' : '#cbd5e1',
                                            color: '#ffffff',
                                            fontSize: '0.70rem',
                                            fontWeight: 800,
                                            padding: '1px 6px',
                                            borderRadius: '10px'
                                        }}>
                                            {supportQueries.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, backgroundColor: helpTab === 'history' ? '#f8fafc' : '#ffffff' }}>
                                {helpTab === 'new' ? (
                                    helpSuccess ? (
                                        <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                                            <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 12px auto' }} />
                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 800, color: '#15803d' }}>
                                                Query Delivered to Admin!
                                            </h4>
                                            <p style={{ margin: '0 0 20px 0', fontSize: '0.86rem', color: '#4b5563', lineHeight: '1.5' }}>
                                                Your message has been sent directly to the Admin team. Admin has received an instant notification in their dashboard.
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setHelpTab('history');
                                                        setHelpSuccess(false);
                                                        setHelpSubject('');
                                                        setHelpMessage('');
                                                        fetchSupportQueries();
                                                    }}
                                                    style={{
                                                        padding: '9px 20px',
                                                        backgroundColor: '#2563eb',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <MessageSquare size={14} /> View in Query History
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowHelpModal(false);
                                                        setHelpSuccess(false);
                                                        setHelpSubject('');
                                                        setHelpMessage('');
                                                    }}
                                                    style={{
                                                        padding: '9px 20px',
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#475569',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '8px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmitHelp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {/* Submitting User Info Pill */}
                                            <div style={{
                                                padding: '10px 14px',
                                                borderRadius: '10px',
                                                backgroundColor: '#eff6ff',
                                                border: '1px solid #bfdbfe',
                                                fontSize: '0.82rem',
                                                color: '#1e40af',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>Submitting as:</span> <strong>{user?.name || 'Staff'}</strong>
                                                </div>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    backgroundColor: '#dbeafe',
                                                    fontSize: '0.74rem',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    color: '#1d4ed8'
                                                }}>
                                                    {user?.role?.replace('_', ' ') || 'User'}
                                                </span>
                                            </div>

                                            {/* Query Type / Category (with NEW "Other" option) */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                    Category
                                                </label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                                    {[
                                                        { id: 'query', label: 'Query', icon: '❓' },
                                                        { id: 'feedback', label: 'Feedback', icon: '💡' },
                                                        { id: 'issue', label: 'Issue / Bug', icon: '🐞' },
                                                        { id: 'urgent', label: 'Urgent Help', icon: '🚨' },
                                                        { id: 'other', label: 'Other', icon: '📌' }
                                                    ].map(cat => (
                                                        <button
                                                            key={cat.id}
                                                            type="button"
                                                            onClick={() => setHelpCategory(cat.id as any)}
                                                            style={{
                                                                padding: '8px 4px',
                                                                borderRadius: '8px',
                                                                border: '1.5px solid',
                                                                borderColor: helpCategory === cat.id ? '#2563eb' : '#cbd5e1',
                                                                backgroundColor: helpCategory === cat.id ? '#eff6ff' : '#ffffff',
                                                                color: helpCategory === cat.id ? '#1d4ed8' : '#64748b',
                                                                fontWeight: 700,
                                                                fontSize: '0.76rem',
                                                                cursor: 'pointer',
                                                                textAlign: 'center',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                gap: '2px'
                                                            }}
                                                        >
                                                            <span style={{ fontSize: '0.95rem' }}>{cat.icon}</span>
                                                            <span>{cat.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Subject */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                    Subject
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={helpSubject}
                                                    onChange={e => setHelpSubject(e.target.value)}
                                                    placeholder="Brief topic of your query or feedback..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 14px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #cbd5e1',
                                                        fontSize: '0.88rem',
                                                        outline: 'none',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>

                                            {/* Message / Details */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                    Message / Description <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <textarea
                                                    required
                                                    rows={4}
                                                    value={helpMessage}
                                                    onChange={e => setHelpMessage(e.target.value)}
                                                    placeholder="Describe your query, feedback, suggestion, or issue in detail..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 14px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #cbd5e1',
                                                        fontSize: '0.88rem',
                                                        outline: 'none',
                                                        resize: 'vertical',
                                                        fontFamily: 'inherit',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>

                                            {helpError && (
                                                <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <AlertCircle size={15} /> {helpError}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowHelpModal(false); setHelpError(''); }}
                                                    style={{
                                                        padding: '9px 18px',
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#475569',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={helpSubmitting || !helpMessage.trim()}
                                                    style={{
                                                        padding: '9px 22px',
                                                        backgroundColor: '#2563eb',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        cursor: (helpSubmitting || !helpMessage.trim()) ? 'not-allowed' : 'pointer',
                                                        opacity: (helpSubmitting || !helpMessage.trim()) ? 0.6 : 1,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                                                    }}
                                                >
                                                    {helpSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                                                    {helpSubmitting ? 'Sending to Admin...' : 'Send to Admin'}
                                                </button>
                                            </div>
                                        </form>
                                    )
                                ) : (
                                    /* TAB: Query History & Chat */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* History Filter Bar */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {[
                                                    { id: 'all', label: `All (${supportQueries.length})` },
                                                    { id: 'pending', label: `Pending (${supportQueries.filter(q => !q.admin_reply).length})` },
                                                    { id: 'answered', label: `Answered (${supportQueries.filter(q => !!q.admin_reply).length})` }
                                                ].map(f => (
                                                    <button
                                                        key={f.id}
                                                        type="button"
                                                        onClick={() => setHistoryFilter(f.id as any)}
                                                        style={{
                                                            padding: '5px 12px',
                                                            borderRadius: '20px',
                                                            border: '1px solid',
                                                            borderColor: historyFilter === f.id ? '#2563eb' : '#cbd5e1',
                                                            backgroundColor: historyFilter === f.id ? '#2563eb' : '#ffffff',
                                                            color: historyFilter === f.id ? '#ffffff' : '#475569',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {f.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={fetchSupportQueries}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    color: '#2563eb',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {supportLoading ? <Loader2 size={12} className="animate-spin" /> : '↻ Refresh'}
                                            </button>
                                        </div>

                                        {supportLoading && supportQueries.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
                                                <Loader2 size={32} className="animate-spin" color="#2563eb" style={{ margin: '0 auto 12px auto' }} />
                                                <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading queries and replies...</p>
                                            </div>
                                        ) : supportQueries.filter(q => {
                                            if (historyFilter === 'pending') return !q.admin_reply;
                                            if (historyFilter === 'answered') return !!q.admin_reply;
                                            return true;
                                        }).length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px 16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                                <MessageSquare size={36} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
                                                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', fontWeight: 800, color: '#1e293b' }}>
                                                    {historyFilter === 'pending' ? 'No Pending Queries' : historyFilter === 'answered' ? 'No Answered Queries' : 'No Queries Found'}
                                                </h4>
                                                <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b' }}>
                                                    {userIsAdmin ? 'No employee queries matching this filter.' : 'You have not submitted any queries in this category.'}
                                                </p>
                                                {!userIsAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setHelpTab('new')}
                                                        style={{
                                                            padding: '7px 16px',
                                                            backgroundColor: '#2563eb',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        + Ask a Query Now
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                {supportQueries
                                                    .filter(q => {
                                                        if (historyFilter === 'pending') return !q.admin_reply;
                                                        if (historyFilter === 'answered') return !!q.admin_reply;
                                                        return true;
                                                    })
                                                    .map(q => {
                                                        const isAnswered = !!q.admin_reply;
                                                        const qType = String(q.query_type || 'query').toLowerCase();
                                                        return (
                                                            <div
                                                                key={q.id}
                                                                style={{
                                                                    backgroundColor: '#ffffff',
                                                                    border: '1.5px solid',
                                                                    borderColor: isAnswered ? '#bbf7d0' : '#fed7aa',
                                                                    borderRadius: '12px',
                                                                    padding: '16px',
                                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                                                }}
                                                            >
                                                                {/* Query Card Top Header */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                        <span style={{
                                                                            backgroundColor: qType === 'issue' ? '#fee2e2' : qType === 'urgent' ? '#ffe4e6' : qType === 'feedback' ? '#fef3c7' : qType === 'other' ? '#f3e8ff' : '#dbeafe',
                                                                            color: qType === 'issue' ? '#b91c1c' : qType === 'urgent' ? '#be123c' : qType === 'feedback' ? '#b45309' : qType === 'other' ? '#6b21a8' : '#1d4ed8',
                                                                            fontSize: '0.72rem',
                                                                            fontWeight: 800,
                                                                            padding: '2px 8px',
                                                                            borderRadius: '6px',
                                                                            textTransform: 'uppercase'
                                                                        }}>
                                                                            {qType === 'other' ? '📌 Other' : qType === 'urgent' ? '🚨 Urgent' : qType === 'issue' ? '🐞 Issue' : qType === 'feedback' ? '💡 Feedback' : '❓ Query'}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>{q.subject}</span>
                                                                    </div>
                                                                    <span style={{
                                                                        backgroundColor: isAnswered ? '#ecfdf5' : '#fff7ed',
                                                                        color: isAnswered ? '#15803d' : '#c2410c',
                                                                        border: `1px solid ${isAnswered ? '#86efac' : '#fed7aa'}`,
                                                                        fontSize: '0.74rem',
                                                                        fontWeight: 800,
                                                                        padding: '3px 8px',
                                                                        borderRadius: '12px',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {isAnswered ? '✅ Answered' : '⏳ Pending Reply'}
                                                                    </span>
                                                                </div>

                                                                {/* Submitter & Timestamp */}
                                                                <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span>👤 <strong>{q.user_name || 'Staff'}</strong> ({q.user_role || 'Staff'})</span>
                                                                    <span>&bull;</span>
                                                                    <span>{q.created_at ? new Date(q.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'}</span>
                                                                </div>

                                                                {/* Employee Question Message */}
                                                                <div style={{
                                                                    backgroundColor: '#f8fafc',
                                                                    border: '1px solid #e2e8f0',
                                                                    borderRadius: '8px',
                                                                    padding: '12px',
                                                                    fontSize: '0.86rem',
                                                                    color: '#334155',
                                                                    lineHeight: '1.55',
                                                                    whiteSpace: 'pre-wrap'
                                                                }}>
                                                                    {q.message}
                                                                </div>

                                                                {/* Admin Reply Chat Box */}
                                                                {isAnswered ? (
                                                                    <div style={{
                                                                        marginTop: '12px',
                                                                        backgroundColor: '#f0fdf4',
                                                                        border: '1.5px solid #86efac',
                                                                        borderRadius: '8px',
                                                                        padding: '12px',
                                                                        boxShadow: '0 1px 2px rgba(22, 163, 74, 0.08)'
                                                                    }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 800, fontSize: '0.82rem' }}>
                                                                                <span>👑 Admin Reply from {q.admin_name || 'Admin'}</span>
                                                                            </div>
                                                                            <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                                                                                {q.replied_at ? new Date(q.replied_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ fontSize: '0.86rem', color: '#14532d', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>
                                                                            {q.admin_reply}
                                                                        </div>
                                                                    </div>
                                                                ) : !userIsAdmin ? (
                                                                    <div style={{
                                                                        marginTop: '10px',
                                                                        padding: '8px 12px',
                                                                        backgroundColor: '#fffbeb',
                                                                        border: '1px solid #fde68a',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.78rem',
                                                                        color: '#92400e',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}>
                                                                        <span>⏳ Awaiting reply from Admin... When Admin replies, you will receive an in-app notification in your dashboard.</span>
                                                                    </div>
                                                                ) : null}

                                                                {/* Admin Reply Action Box for Admin Users */}
                                                                {userIsAdmin && (
                                                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                                            <textarea
                                                                                rows={2}
                                                                                value={replyTextMap[q.id] !== undefined ? replyTextMap[q.id] : ''}
                                                                                onChange={e => setReplyTextMap(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                                                placeholder={isAnswered ? "Write an updated or additional reply..." : `Type reply to ${q.user_name || 'employee'}...`}
                                                                                style={{
                                                                                    flex: 1,
                                                                                    padding: '8px 12px',
                                                                                    borderRadius: '8px',
                                                                                    border: '1.5px solid #cbd5e1',
                                                                                    fontSize: '0.84rem',
                                                                                    outline: 'none',
                                                                                    resize: 'vertical',
                                                                                    fontFamily: 'inherit',
                                                                                    boxSizing: 'border-box'
                                                                                }}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                disabled={replySubmittingMap[q.id] || !(replyTextMap[q.id] || '').trim()}
                                                                                onClick={() => handleSendAdminReply(q.id)}
                                                                                style={{
                                                                                    padding: '8px 16px',
                                                                                    backgroundColor: '#2563eb',
                                                                                    color: '#ffffff',
                                                                                    border: 'none',
                                                                                    borderRadius: '8px',
                                                                                    fontWeight: 700,
                                                                                    fontSize: '0.82rem',
                                                                                    cursor: (replySubmittingMap[q.id] || !(replyTextMap[q.id] || '').trim()) ? 'not-allowed' : 'pointer',
                                                                                    opacity: (replySubmittingMap[q.id] || !(replyTextMap[q.id] || '').trim()) ? 0.6 : 1,
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '6px',
                                                                                    whiteSpace: 'nowrap',
                                                                                    height: '38px',
                                                                                    boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                                                                                }}
                                                                            >
                                                                                {replySubmittingMap[q.id] ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                                                                                <span>{isAnswered ? 'Update Reply' : 'Send Reply'}</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
