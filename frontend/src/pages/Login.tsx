import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import { Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/Logo.png';

export const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post('http://localhost/ARK/api/auth/login', {
                username,
                password,
            });

            if (response.data.success) {
                const userData = response.data.data;
            
                // ✅ Save to localStorage
                localStorage.setItem("user", JSON.stringify(userData));
            
                // ✅ Set in context
                login(userData);
            
                if (userData.role === 'site_engineer') {
                    navigate('/projects');
                } else {
                    navigate('/');
                }
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError('An error occurred. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f4f6',
            backgroundImage: 'radial-gradient(rgba(37, 59, 80, 0.1) 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px'
        }}>
            <div className="premium-card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <img src={logo} alt="ARK Logo" style={{ width: '80px', marginBottom: '16px' }} />
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>ARK ARCHITECTS</h2>
                    <p style={{ color: '#6b7280' }}>Project Management System</p>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>Username</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder="Admin Username"
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 40px',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#253b50'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '12px 40px 12px 40px',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#253b50'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                            />
                            <div
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            backgroundColor: '#253b50',
                            color: 'white',
                            padding: '14px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Login to System'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280', fontSize: '0.85rem' }}>
                    Contact administrator if you lost your access.
                </p>
            </div>
        </div>
    );
};
