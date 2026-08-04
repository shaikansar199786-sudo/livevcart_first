import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import { User, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import liveLogo from '../assets/live-logo.png';

import { API_BASE_URL } from '../config';

interface SystemUser {
    user_id: number;
    username: string;
    role: string;
    name: string;
}

export const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (isForgotPassword) {
            if (!username) {
                setError('Please enter your email ID');
                return;
            }
            setLoading(true);
            try {
                const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
                    email: username
                });
                
                if (response.data.success) {
                    if (response.data.debug_link) {
                        setSuccessMessage(`Reset link generated (Local Test Mode):\n\n${response.data.debug_link}`);
                    } else {
                        setSuccessMessage(response.data.message);
                    }
                } else {
                    setError(response.data.message || 'Failed to send reset link.');
                }
            } catch (err) {
                setError('An error occurred. Please check your connection.');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (!username || !password) {
            setError('Please enter both Email ID and password');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login`, {
                username,
                password,
            });

            if (response.data.success) {
                const userData = response.data.data;
                localStorage.setItem("user", JSON.stringify(userData));
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
            backgroundColor: '#fff7ed',
            backgroundImage: 'radial-gradient(rgba(249, 115, 22, 0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
        }}>
            <div className="premium-card" style={{ width: '100%', maxWidth: '400px', padding: '40px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(249, 115, 22, 0.08)' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', padding: '16px', borderRadius: '16px', marginBottom: '20px' }}>
                        <img src={liveLogo} alt="Livincart Logo" style={{ height: '40px' }} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>Livincart ARCHITECTS</h2>
                    <p style={{ color: '#f97316', fontWeight: 600, margin: 0 }}>
                        {isForgotPassword ? 'Reset Password' : 'Project Management System'}
                    </p>
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
                
                {successMessage && (
                    <div style={{
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        fontSize: '0.9rem',
                        textAlign: 'center',
                        wordBreak: 'break-all'
                    }}>
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>Email ID</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                type="email"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your email ID"
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 40px',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    backgroundColor: '#fff'
                                }}
                                onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.1)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>
                    </div>
                    
                    {!isForgotPassword && (
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 40px 12px 40px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        backgroundColor: '#fff'
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        color: '#9ca3af',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {!isForgotPassword && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                            <button 
                                type="button"
                                onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMessage(''); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#f97316',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}
                    
                    {isForgotPassword && (
                        <div style={{ marginBottom: '24px' }}></div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !username || (!isForgotPassword && !password)}
                        style={{
                            width: '100%',
                            backgroundColor: (loading || !username || (!isForgotPassword && !password)) ? '#fb923c' : '#f97316',
                            color: 'white',
                            padding: '14px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: (loading || !username || (!isForgotPassword && !password)) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
                        }}
                        onMouseEnter={(e) => { if (!loading && username && (isForgotPassword || password)) e.currentTarget.style.backgroundColor = '#ea580c' }}
                        onMouseLeave={(e) => { if (!loading && username && (isForgotPassword || password)) e.currentTarget.style.backgroundColor = '#f97316' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (isForgotPassword ? 'Send Magic Link' : 'Login')}
                    </button>
                    
                    {isForgotPassword && (
                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <button 
                                type="button"
                                onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMessage(''); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#6b7280',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                Back to Login
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};
