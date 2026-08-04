import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import liveLogo from '../assets/live-logo.png';
import { API_BASE_URL } from '../config';

export const ResetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!token) {
            setError('Invalid or missing reset token.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
                token,
                password,
            });

            if (response.data.success) {
                setSuccessMessage(response.data.message);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError('An error occurred. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    if (!token && !error) {
        setError('No reset token provided in the URL.');
    }

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
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>Set New Password</h2>
                    <p style={{ color: '#f97316', fontWeight: 600, margin: 0 }}>Livincart ARCHITECTS</p>
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

                {successMessage ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '1rem',
                            fontWeight: 500
                        }}>
                            {successMessage}
                        </div>
                        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Redirecting to login...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>New Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    required
                                    disabled={!token}
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
                        
                        <div style={{ marginBottom: '32px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                    disabled={!token}
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

                        <button
                            type="submit"
                            disabled={loading || !password || !confirmPassword || !token}
                            style={{
                                width: '100%',
                                backgroundColor: (loading || !password || !confirmPassword || !token) ? '#fb923c' : '#f97316',
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
                                cursor: (loading || !password || !confirmPassword || !token) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
                            }}
                            onMouseEnter={(e) => { if (!loading && password && confirmPassword && token) e.currentTarget.style.backgroundColor = '#ea580c' }}
                            onMouseLeave={(e) => { if (!loading && password && confirmPassword && token) e.currentTarget.style.backgroundColor = '#f97316' }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
                        </button>
                    </form>
                )}
                
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button 
                        type="button"
                        onClick={() => navigate('/login')}
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
            </div>
        </div>
    );
};
