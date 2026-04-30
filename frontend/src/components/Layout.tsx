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
    LogOut
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import logo from '../assets/logo_new.png';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const allMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['principal_architect', 'admin', 'accountant', 'project_head'] },
        { icon: Users, label: 'Clients', path: '/clients', roles: ['principal_architect', 'admin', 'accountant'] },
        { icon: Briefcase, label: 'Projects', path: '/projects', roles: ['principal_architect', 'admin', 'accountant', 'project_head', 'site_engineer'] },
        { icon: HardHat, label: 'Contractors', path: '/vendors', roles: ['principal_architect', 'admin', 'accountant', 'project_head'] },
        { icon: ShoppingCart, label: 'Vendors', path: '/global-vendors', roles: ['principal_architect', 'admin', 'accountant', 'project_head'] },
        { icon: CreditCard, label: 'Finance', path: '/finance', roles: ['principal_architect', 'accountant'] },
        { icon: FileText, label: 'Agreements', path: '/agreements', roles: ['principal_architect', 'admin', 'accountant'] },
        { icon: FileText, label: 'Estimation Quota', path: '/quotes', roles: ['principal_architect', 'admin', 'accountant'] },
        { icon: Users, label: 'Team', path: '/team', roles: ['principal_architect'] },
    ];

    const menuItems = allMenuItems.filter(item => user && item.roles.includes(user.role as any));

    return (
        <div className="layout-container">
            <aside className="sidebar" style={{ width: '280px', height: '100vh', position: 'fixed', left: 0, top: 0, backgroundColor: '#1a222c', color: 'white', display: 'flex', flexDirection: 'column', borderRight: '1px solid #2d3748' }}>
                <div className="sidebar-header" style={{ padding: '32px 24px', textAlign: 'center', borderBottom: '1px solid #2d3748' }}>
                    <div style={{
                        width: '220px',
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0' // removed padding to maximize size
                    }}>
                        <img src={logo} alt="Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
                    </div>
                </div>
                <nav className="sidebar-nav" style={{ flex: 1, padding: '24px 16px', overflowY: 'auto' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {menuItems.map((item, index) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <li key={index} style={{ marginBottom: '6px' }}>
                                    <Link
                                        to={item.path}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '14px 20px',
                                            color: isActive ? '#fff' : '#a0aec0',
                                            backgroundColor: isActive ? '#253b50' : 'transparent',
                                            textDecoration: 'none',
                                            borderRadius: '12px',
                                            transition: 'all 0.3s ease',
                                            boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                                        }}
                                    >
                                        <item.icon size={20} style={{ marginRight: '16px', color: isActive ? '#63b3ed' : '#718096' }} />
                                        <span style={{ fontWeight: isActive ? 700 : 500, fontSize: '0.95rem' }}>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
                <div className="sidebar-footer" style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        <LogOut size={18} style={{ marginRight: '12px' }} />
                        Logout
                    </button>
                </div>
            </aside>
            <main className="main-content">
                <header style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '40px',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '20px'
                }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>ARK Management System</h1>
                        <p style={{ color: '#6b7280' }}>Dashboard / {menuItems.find(i => i.path === location.pathname)?.label || 'Overview'}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: 600 }}>{user?.name}</p>
                            <p style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'capitalize' }}>{user?.role.replace('_', ' ')}</p>
                        </div>
                        <div style={{
                            width: '45px',
                            height: '45px',
                            borderRadius: '50%',
                            backgroundColor: '#253b50',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                        }}>
                            {user?.name.charAt(0)}
                        </div>
                    </div>
                </header>
                {children}
            </main>
        </div>
    );
};
