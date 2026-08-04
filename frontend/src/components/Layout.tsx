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
    Receipt
} from 'lucide-react';
import { useState, useEffect } from 'react';
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
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 15000); // poll every 15s
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

    const handleReadNotification = async (id: number, notif?: any) => {
        try {
            await axios.post(`${API_BASE_URL}/notifications/read`, { notification_id: id });
            setNotifications(prev => prev.filter(n => n.id !== id));
            setShowNotifications(false);
            if (notif && (String(notif.title).toLowerCase().includes('timeline') || String(notif.message).toLowerCase().includes('timeline') || String(notif.title).toLowerCase().includes('approval'))) {
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

    const allMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/overview', roles: ['admin', 'project_manager', 'manager', 'site_inspection', 'site_inspector'] },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/d1-dashboard', roles: ['d1', 'd2'], excludeAdmin: true },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/mb-dashboard', roles: ['business_associate'], excludeAdmin: true },
        { icon: Clock, label: 'Livincart Project Timelines', path: '/project-timelines', roles: ['admin', 'project_manager', 'manager', 'project_head'] },
        { icon: TrendingUp, label: 'Analysis', path: '/analysis', roles: ['project_manager', 'manager'], excludeAdmin: true },
        { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['admin', 'sales', 'project_manager', 'manager'] },
        { icon: Target, label: 'D1 / D2 Leads', path: '/d1-leads', roles: ['d1', 'd2', 'admin', 'project_manager', 'manager'] },
        { icon: Target, label: 'Leads', path: '/leads', roles: ['admin', 'sales', 'project_manager', 'manager'] },
        { icon: Palette, label: 'GD Dashboard', path: '/gd-dashboard', roles: ['graphic_designer', 'gd'], gdOnly: true },
        { icon: CheckSquare, label: 'GD Tasks & Targets', path: '/gd-tasks', roles: ['graphic_designer', 'gd'], gdOnly: true },
        { icon: CheckSquare, label: 'GD Approvals', path: '/admin-gd-tasks', roles: ['graphic_designer', 'gd'], gdOnly: true },
        { icon: CheckSquare, label: 'Task List', path: '/mb-tasks', roles: ['business_associate'] },
        { icon: Users, label: 'Clients', path: '/clients', roles: ['admin', 'accountant', 'project_head', 'sales', 'project_manager', 'manager', 'd1', 'd2'] },
        { icon: Briefcase, label: 'Projects', path: '/projects', roles: ['admin', 'accountant', 'project_head', 'site_engineer', 'project_manager', 'manager', 'd1', 'd2', 'site_inspection', 'site_inspector', 'mmt'] },
        { icon: HardHat, label: 'Contractors', path: '/vendors', roles: ['admin', 'accountant', 'project_manager', 'manager', 'mmt'] },
        { icon: ShoppingCart, label: 'Vendors', path: '/global-vendors', roles: ['admin', 'accountant', 'project_manager', 'manager', 'mmt'] },
        { icon: CreditCard, label: 'Finance', path: '/finance', roles: ['accountant', 'admin'] },
        { icon: Wallet, label: 'Financial Overview', path: '/financial-overview', roles: ['admin'] },
        { icon: FileText, label: 'Agreements', path: '/agreements', roles: ['admin', 'accountant', 'sales', 'project_manager', 'manager'] },
        { icon: FileText, label: 'Quotes / Estimations', path: '/quotes', roles: ['admin', 'accountant', 'sales', 'project_manager', 'manager', 'project_head', 'd1', 'd2'] },

        { icon: Users, label: 'Team', path: '/team', roles: ['admin', 'project_manager', 'manager'] },
        { icon: Building2, label: 'Company Expenses', path: '/company-expenses', roles: ['admin', 'project_manager', 'manager'] },
        { icon: Receipt, label: 'Reimbursements', path: '/reimbursements', roles: ['admin', 'sales', 'd1', 'd2', 'project_manager', 'manager', 'project_head', 'accountant', 'graphic_designer', 'gd', 'site_engineer', 'site_inspection', 'site_inspector', 'mmt', 'business_associate'] },
        { icon: Wallet, label: 'Staff Reimbursements', path: '/staff-reimbursements', roles: ['admin', 'project_manager', 'manager'] },
    ];

    const menuItems = allMenuItems.filter(item => {
        if (!user) return false;
        const uRole = String(user.role || '').toLowerCase();
        const isGd = uRole.includes('graphic') || uRole === 'gd';

        if ((item as any).excludeAdmin && uRole === 'admin') return false;

        if ((item as any).gdOnly) {
            return isGd;
        }

        if (uRole === 'admin') return true;
        
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
            <aside className={`sidebar sidebar-container ${isSidebarOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`} style={{ height: '125vh', position: 'fixed', left: 0, top: 0, color: 'white', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
                <div className="sidebar-header" style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={liveLogo} alt="Logo" style={{ height: isCollapsed ? '28px' : '40px', objectFit: 'contain', transition: 'all 0.3s' }} />
                        {!isCollapsed && (
                            <div className="sidebar-header-text" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: '1.1', color: '#ffffff' }}>Livincart</span>
                                <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#a1a1aa' }}>Project Timelines</span>
                            </div>
                        )}
                    </div>
                    {!isCollapsed && (
                        <button
                            className="no-print desktop-collapse-btn"
                            onClick={() => setIsCollapsed(true)}
                            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: window.innerWidth <= 1024 ? 'none' : 'block' }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                </div>
                {isCollapsed && (
                    <button
                        className="no-print desktop-collapse-btn"
                        onClick={() => setIsCollapsed(false)}
                        style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', margin: '0 auto 10px auto', display: window.innerWidth <= 1024 ? 'none' : 'block' }}
                    >
                        <ChevronRight size={20} />
                    </button>
                )}
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
                                        <item.icon size={20} className="sidebar-icon" style={{ marginRight: isCollapsed ? 0 : '16px' }} />
                                        {!isCollapsed && <span className="sidebar-text" style={{ fontWeight: isActive ? 700 : 500, fontSize: '0.95rem' }}>{item.label}</span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {!isCollapsed && (
                    <div style={{ padding: '20px', marginTop: 'auto' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '50%', color: '#a1a1aa' }}>
                                    <Headphones size={20} />
                                </div>
                                <div>
                                    <p style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Need Help?</p>
                                    <p style={{ color: '#a1a1aa', fontSize: '0.8rem', margin: 0 }}>Contact Support</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
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
                        <div style={{ position: 'relative' }}>
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
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.4' }}>{notif.message}</p>
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
            </main>
        </div>
    );
};
