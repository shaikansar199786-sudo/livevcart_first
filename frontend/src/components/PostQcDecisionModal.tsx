import React, { useState, useEffect } from 'react';
import { X, Eye, AlertTriangle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

interface PostQcDecisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | number;
    finalBudget: number;
    onContinue: () => void; // Trigger view customer payment modal
    isAdmin?: boolean;
}

export const PostQcDecisionModal: React.FC<PostQcDecisionModalProps> = ({
    isOpen,
    onClose,
    projectId,
    finalBudget = 0,
    onContinue,
    isAdmin: propIsAdmin
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);

    const isUserAdmin = propIsAdmin !== undefined ? Boolean(propIsAdmin) : Boolean(
        user?.role === 'admin' ||
        user?.is_admin === 1 ||
        user?.is_admin === true ||
        String(user?.is_admin) === '1'
    );

    const stage3Amount = Math.round(finalBudget * 0.40);

    const handleWithdraw = async () => {
        if (!window.confirm("⚠️ Confirm Project Withdrawal\n\nAre you sure the client wishes to WITHDRAW from this project?\n\nThis will mark the project status as Lost.")) {
            return;
        }

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/projects/update-status`, {
                project_id: projectId,
                status: 'lost'
            });

            if (res.data && (res.data.success || res.data.status === 'success')) {
                alert('Project marked as Withdrawn / Lost.');
                sessionStorage.setItem(`dismissed_post_qc_${projectId}`, 'true');
                onClose();
                navigate('/projects');
            } else {
                alert(res.data?.message || 'Failed to update project status');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Failed to update status');
        } finally {
            setSubmitting(false);
        }
    };

    // Close or Cancel handler:
    // Non-admin (employee) exits from the project back to /projects
    // Admin only can close the modal and stay to view/inspect the project
    const handleCancelOrClose = () => {
        if (!isUserAdmin) {
            onClose();
            navigate('/projects', { replace: true });
            // Immediate fallback to ensure employee never stays on the project
            setTimeout(() => {
                if (window.location.pathname.includes('/projects/')) {
                    window.location.href = '/projects';
                }
            }, 60);
        } else {
            sessionStorage.setItem(`dismissed_post_qc_${projectId}`, 'true');
            onClose();
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCancelOrClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isUserAdmin, projectId]);

    if (!isOpen) return null;

    return (
        <div
            onClick={(e) => {
                // If user clicks backdrop, call handleCancelOrClose (exits employee to /projects, or dismisses for admin)
                if (e.target === e.currentTarget) {
                    handleCancelOrClose();
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3500,
                padding: '16px'
            }}
        >
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                maxWidth: '560px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px 28px',
                boxSizing: 'border-box',
                position: 'relative',
                animation: 'scaleIn 0.2s ease-out'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📋</span>
                        <div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                                Client Decision (Post-QC Verification)
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '3px 0 0 0', fontWeight: 500 }}>
                                Required before proceeding with project execution
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCancelOrClose}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.15s ease'
                        }}
                        title={isUserAdmin ? "Close & View Project (Admin)" : "Cancel & Exit to Projects"}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Explanation text */}
                <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                    Quality Check (QC) verification is complete. Based on QC feedback, the budget has been recalculated and finalized.
                </p>

                {/* Budget Summary Card */}
                <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    marginBottom: '18px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                            Final Project Budget:
                        </span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                            ₹{Math.round(finalBudget).toLocaleString('en-IN')}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
                            Required 40% Stage Payment:
                        </span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#15803d' }}>
                            ₹{stage3Amount.toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>

                {/* Question Prompt */}
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                    Does the client wish to Continue or Withdraw from the project?
                </div>

                {/* Role-based Notice Box */}
                {isUserAdmin ? (
                    <div style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '20px'
                    }}>
                        <p style={{ fontSize: '0.78rem', color: '#1e40af', margin: 0, lineHeight: 1.45 }}>
                            <strong style={{ fontWeight: 800 }}>🛡️ Admin Access:</strong> You can add/record the 40% customer payment, withdraw the project, or click Cancel / ✕ to close this modal and view the project.
                        </p>
                    </div>
                ) : (
                    <div style={{
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '20px'
                    }}>
                        <p style={{ fontSize: '0.78rem', color: '#991b1b', margin: 0, lineHeight: 1.45 }}>
                            <strong style={{ fontWeight: 800 }}>⚠️ Employee Access:</strong> You can view the customer payment stages and milestones. Selecting <strong>Cancel</strong> or <strong>✕</strong> will exit from this project back to the Projects list.
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '12px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={submitting}
                        style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                        Withdraw (Mark Lost)
                    </button>

                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={submitting}
                        style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Eye size={16} />
                        View Customer Payment &amp; Stages
                    </button>
                </div>

                {/* Cancel Button */}
                <div style={{ textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={handleCancelOrClose}
                        disabled={submitting}
                        style={{
                            padding: '8px 18px',
                            borderRadius: '8px',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <ArrowLeft size={14} />
                        {isUserAdmin ? 'Cancel (Close & View Project)' : 'Cancel & Exit to Projects'}
                    </button>
                </div>
            </div>
        </div>
    );
};
