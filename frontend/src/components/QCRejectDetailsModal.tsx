import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    X,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    MessageSquare,
    Send,
    Loader2,
    Info,
    ChevronDown,
    ChevronRight,
    CornerDownRight
} from 'lucide-react';

interface QCRejectDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    folderId?: number | null;
    projectId: string | number;
    versionNumber?: number;
    onGoToQuotation?: () => void;
}

export const QCRejectDetailsModal: React.FC<QCRejectDetailsModalProps> = ({
    isOpen,
    onClose,
    folderId,
    projectId,
    versionNumber,
    onGoToQuotation
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        folder: any;
        files: any[];
        comments: any[];
    } | null>(null);

    const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});
    const [postingReplyId, setPostingReplyId] = useState<number | null>(null);
    const [resolvingCommentId, setResolvingCommentId] = useState<number | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (!isOpen) return;

        const loadDetails = async () => {
            setLoading(true);
            try {
                let targetFid = folderId;

                // If folderId is not directly passed, locate the relevant folder for this project and version
                if (!targetFid) {
                    const folRes = await axios.get(`${API_BASE_URL}/qc/folders?project_id=${projectId}`);
                    if (folRes.data.success && Array.isArray(folRes.data.data)) {
                        const folders = folRes.data.data;
                        let match = null;
                        if (versionNumber) {
                            match = folders.find((f: any) => Number(f.version_number) === Number(versionNumber));
                        }
                        if (!match) {
                            match = folders.find((f: any) => f.pm_status === 'pm_rejected' || f.status === 'changes_requested') || folders[0];
                        }
                        if (match) targetFid = match.folder_id;
                    }
                }

                if (targetFid) {
                    const res = await axios.get(`${API_BASE_URL}/qc/reject-details?folder_id=${targetFid}`);
                    if (res.data.success && res.data.data) {
                        setData(res.data.data);
                        // By default expand files that have comments or are rejected
                        const initialExpanded: Record<number, boolean> = {};
                        (res.data.data.files || []).forEach((f: any) => {
                            if (f.status === 'changes_requested' || f.status === 'rejected') {
                                initialExpanded[f.file_id] = true;
                            }
                        });
                        setExpandedFiles(initialExpanded);
                    }
                }
            } catch (err) {
                console.error('Failed to load reject details', err);
            } finally {
                setLoading(false);
            }
        };

        loadDetails();
    }, [isOpen, folderId, projectId, versionNumber]);

    const handleSendReply = async (commentId: number) => {
        const text = (replyTextMap[commentId] || '').trim();
        if (!text) return;

        setPostingReplyId(commentId);
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/add-reply`, {
                comment_id: commentId,
                reply_text: text,
                user_name: user?.name || 'Designer',
                user_role: user?.role || 'designer'
            });

            if (res.data.success) {
                // Append reply locally
                setData(prev => {
                    if (!prev) return prev;
                    const newComments = prev.comments.map(c => {
                        if (c.comment_id === commentId) {
                            const newReply = {
                                reply_id: res.data.reply_id || Date.now(),
                                comment_id: commentId,
                                user_name: user?.name || 'Designer',
                                user_role: user?.role || 'designer',
                                reply_text: text,
                                created_at: new Date().toISOString()
                            };
                            return { ...c, status: 'resolved', replies: [...(c.replies || []), newReply] };
                        }
                        return c;
                    });
                    return { ...prev, comments: newComments };
                });
                setReplyTextMap(prev => ({ ...prev, [commentId]: '' }));
            } else {
                alert('Failed to post reply: ' + res.data.message);
            }
        } catch (err) {
            alert('Error sending reply');
        } finally {
            setPostingReplyId(null);
        }
    };

    const handleResolveComment = async (commentId: number) => {
        const text = (replyTextMap[commentId] || '').trim();
        const targetComment = data?.comments?.find(c => c.comment_id === commentId);
        const hasReplies = targetComment && Array.isArray(targetComment.replies) && targetComment.replies.length > 0;

        if (!hasReplies && !text) {
            alert('Please enter a note explaining how you rectified this issue before marking it resolved.');
            return;
        }

        setResolvingCommentId(commentId);
        try {
            // If user typed a reply, submit it first
            if (text) {
                const replyRes = await axios.post(`${API_BASE_URL}/qc/add-reply`, {
                    comment_id: commentId,
                    reply_text: text,
                    user_name: user?.name || 'Designer',
                    user_role: user?.role || 'designer'
                });

                if (replyRes.data.success) {
                    const newReply = {
                        reply_id: replyRes.data.reply_id || Date.now(),
                        comment_id: commentId,
                        user_name: user?.name || 'Designer',
                        user_role: user?.role || 'designer',
                        reply_text: text,
                        created_at: new Date().toISOString()
                    };
                    setData(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            comments: prev.comments.map(c => c.comment_id === commentId ? { ...c, replies: [...(c.replies || []), newReply] } : c)
                        };
                    });
                    setReplyTextMap(prev => ({ ...prev, [commentId]: '' }));
                }
            }

            // Mark as resolved
            const res = await axios.post(`${API_BASE_URL}/qc/resolve-comment`, {
                comment_id: commentId,
                status: 'resolved'
            });

            if (res.data.success) {
                setData(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        comments: prev.comments.map(c => c.comment_id === commentId ? { ...c, status: 'resolved' } : c)
                    };
                });
            } else {
                alert('Failed to resolve comment: ' + res.data.message);
            }
        } catch (err) {
            alert('Error updating comment status');
        } finally {
            setResolvingCommentId(null);
        }
    };

    const toggleFileExpand = (fileId: number) => {
        setExpandedFiles(prev => ({ ...prev, [fileId]: !prev[fileId] }));
    };

    if (!isOpen) return null;

    const files = data?.files || [];
    const comments = data?.comments || [];
    const folder = data?.folder || {};
    const displayVersion = folder.version_number || versionNumber || 1;
    const isPMRejected = folder.pm_status === 'pm_rejected';

    const modalContent = (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isPMRejected ? '#fff1f2' : '#fef2f2'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            backgroundColor: isPMRejected ? '#ffe4e6' : '#fee2e2',
                            color: isPMRejected ? '#e11d48' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: isPMRejected ? '#9f1239' : '#991b1b' }}>
                                    {isPMRejected ? `Rejected by Project Manager (PM) — Version ${displayVersion}` : `QC Corrections Required — Version ${displayVersion}`}
                                </h3>
                                <span style={{
                                    backgroundColor: isPMRejected ? '#e11d48' : '#dc2626',
                                    color: '#ffffff',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase'
                                }}>
                                    {isPMRejected ? 'Rejected by PM' : 'Rejected'}
                                </span>
                                {(() => {
                                    if (!comments || comments.length === 0) return null;
                                    const openCount = comments.filter((c: any) => c.status === 'open' || c.status === 'reopen').length;
                                    const resolvedCount = comments.filter((c: any) => c.status === 'resolved' || c.status === 'approved').length;
                                    if (openCount > 0) {
                                        return (
                                            <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={12} /> {openCount > 1 ? `${openCount} Open` : 'Open'}
                                            </span>
                                        );
                                    }
                                    if (resolvedCount > 0) {
                                        return (
                                            <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle2 size={12} /> Resolved
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: isPMRejected ? '#881337' : '#7f1d1d' }}>
                                Project ID: <strong>{projectId}</strong> • {isPMRejected ? 'Review PM notes and rectify reopened comments below, then upload and Send to QC' : 'Please review feedback below and provide updated drawings/quotation'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isPMRejected ? '#9f1239' : '#991b1b',
                            padding: '6px',
                            borderRadius: '8px'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                            <Loader2 className="animate-spin" size={32} color="#dc2626" />
                            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Loading QC rejection details...</span>
                        </div>
                    ) : (
                        <>
                            {/* PM Rejection Banner if rejected by PM */}
                            {isPMRejected && (
                                <div style={{
                                    backgroundColor: '#fff1f2',
                                    border: '1.5px solid #fecdd3',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'flex',
                                    gap: '14px',
                                    alignItems: 'flex-start',
                                    boxShadow: '0 2px 8px rgba(225, 29, 72, 0.08)'
                                }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48', flexShrink: 0 }}>
                                        <AlertTriangle size={22} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <strong style={{ fontSize: '0.94rem', color: '#9f1239' }}>Project Manager (PM) Rejection Notes</strong>
                                            <span style={{ backgroundColor: '#e11d48', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', textTransform: 'uppercase' }}>
                                                Trigger: Rejected by PM
                                            </span>
                                        </div>
                                        {folder.pm_notes ? (
                                            <div style={{ fontSize: '0.86rem', color: '#881337', marginTop: '6px', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecdd3', fontStyle: 'italic', lineHeight: 1.5 }}>
                                                "{folder.pm_notes}"
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.82rem', color: '#881337', marginTop: '4px' }}>
                                                Project Manager returned this version for corrections before final approval.
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.74rem', color: '#be123c', marginTop: '6px', display: 'flex', gap: '10px' }}>
                                            <span>Reviewed by: <strong>{folder.pm_reviewer_name || 'Project Manager'}</strong></span>
                                            {folder.pm_reviewed_at && (
                                                <>
                                                    <span>•</span>
                                                    <span>{new Date(folder.pm_reviewed_at).toLocaleString()}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Summary Guidance Banner */}
                            <div style={{
                                backgroundColor: '#fff7ed',
                                border: '1px solid #ffedd5',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                gap: '14px',
                                alignItems: 'flex-start'
                            }}>
                                <Info size={20} color="#ea580c" style={{ marginTop: '2px', flexShrink: 0 }} />
                                <div style={{ fontSize: '0.84rem', color: '#9a3412', lineHeight: 1.5 }}>
                                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.88rem' }}>How Correction &amp; Next Version Works:</strong>
                                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <li><strong>Check Reopened Issues:</strong> Check all open or reopened comments below, add replies, and mark them <em>Resolved</em>.</li>
                                        <li><strong>Approved files (e.g. File x):</strong> Already fully approved files will <em>automatically retain Approved status</em> in Version {Number(displayVersion) + 1}.</li>
                                        <li><strong>Send to QC for Final Approval:</strong> Once corrected and files uploaded, click <strong>Send to QC</strong> to submit Version {Number(displayVersion) + 1} for final approval!</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Files & Rejection Details List */}
                            <div>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={16} color="#475569" />
                                    Files &amp; Feedback in Version {displayVersion} ({files.length} {files.length === 1 ? 'file' : 'files'})
                                </h4>

                                {files.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                                        No files found in this version folder.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {files.map((file: any) => {
                                            const fileComments = comments.filter((c: any) => Number(c.file_id) === Number(file.file_id));
                                            const isExpanded = !!expandedFiles[file.file_id];
                                            const isApproved = file.status === 'approved';
                                            const isRejected = file.status === 'changes_requested' || file.status === 'rejected';

                                            return (
                                                <div
                                                    key={file.file_id}
                                                    style={{
                                                        borderRadius: '12px',
                                                        border: isRejected ? '1.5px solid #fecaca' : isApproved ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                                        backgroundColor: isRejected ? '#fffbfb' : isApproved ? '#f0fdf4' : '#ffffff',
                                                        overflow: 'hidden',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                                                    }}
                                                >
                                                    {/* File Card Header */}
                                                    <div
                                                        onClick={() => toggleFileExpand(file.file_id)}
                                                        style={{
                                                            padding: '12px 16px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            cursor: 'pointer',
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {isApproved ? (
                                                                <CheckCircle2 size={18} color="#16a34a" />
                                                            ) : isRejected ? (
                                                                <AlertTriangle size={18} color="#dc2626" />
                                                            ) : (
                                                                <Clock size={18} color="#2563eb" />
                                                            )}
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                                                                    {file.file_name}
                                                                </div>
                                                                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', gap: '8px' }}>
                                                                    <span>Uploaded by: {file.uploader_name || 'System'}</span>
                                                                    <span>•</span>
                                                                    <span>{new Date(file.uploaded_at).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {/* Status Badge */}
                                                            {isApproved ? (
                                                                <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '3px 9px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <CheckCircle2 size={12} /> Approved (Carries Over)
                                                                </span>
                                                            ) : isRejected ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '3px 9px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <AlertTriangle size={12} /> Corrections Required ({fileComments.length})
                                                                    </span>
                                                                    {(() => {
                                                                        if (!fileComments || fileComments.length === 0) return null;
                                                                        const openCount = fileComments.filter((c: any) => c.status === 'open' || c.status === 'reopen').length;
                                                                        const resolvedCount = fileComments.filter((c: any) => c.status === 'resolved' || c.status === 'approved').length;
                                                                        if (openCount > 0) {
                                                                            return (
                                                                                <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <Clock size={12} /> {openCount > 1 ? `${openCount} Open` : 'Open'}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        if (resolvedCount > 0) {
                                                                            return (
                                                                                <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <CheckCircle2 size={12} /> Resolved
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '3px 9px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Clock size={12} /> Under Review
                                                                </span>
                                                            )}

                                                            {isExpanded ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
                                                        </div>
                                                    </div>

                                                    {/* File Comments / Issues Details (if expanded) */}
                                                    {isExpanded && (
                                                        <div style={{ padding: '14px 16px', borderTop: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                                                            {fileComments.length === 0 ? (
                                                                <div style={{ fontSize: '0.82rem', color: isApproved ? '#166534' : '#64748b', fontStyle: 'italic' }}>
                                                                    {isApproved ? '✓ All inspection checks passed. This file is approved.' : 'No detailed issue notes attached to this file.'}
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                    {fileComments.map((comment: any) => {
                                                                        const sevColor = comment.severity === 'high' ? '#dc2626' : comment.severity === 'low' ? '#16a34a' : '#d97706';
                                                                        const sevBg = comment.severity === 'high' ? '#fef2f2' : comment.severity === 'low' ? '#f0fdf4' : '#fffbeb';

                                                                        return (
                                                                            <div
                                                                                key={comment.comment_id}
                                                                                style={{
                                                                                    borderRadius: '10px',
                                                                                    border: comment.status === 'reopen' ? '1.5px solid #fed7aa' : '1px solid #e2e8f0',
                                                                                    backgroundColor: comment.status === 'reopen' ? '#fffaf5' : '#f8fafc',
                                                                                    padding: '12px 14px'
                                                                                }}
                                                                            >
                                                                                {/* Comment Header */}
                                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        {/* Status Badge */}
                                                                                        {comment.status === 'reopen' ? (
                                                                                            <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', fontSize: '0.70rem', fontWeight: 800, padding: '2px 7px', borderRadius: '6px' }}>
                                                                                                🔄 Reopened by PM/QC
                                                                                            </span>
                                                                                        ) : comment.status === 'resolved' ? (
                                                                                            <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '0.70rem', fontWeight: 800, padding: '2px 7px', borderRadius: '6px' }}>
                                                                                                ✅ Resolved
                                                                                            </span>
                                                                                        ) : comment.status === 'approved' ? (
                                                                                            <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7', fontSize: '0.70rem', fontWeight: 800, padding: '2px 7px', borderRadius: '6px' }}>
                                                                                                🟢 Approved
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', fontSize: '0.70rem', fontWeight: 800, padding: '2px 7px', borderRadius: '6px' }}>
                                                                                                🟠 Open Issue
                                                                                            </span>
                                                                                        )}

                                                                                        <span style={{
                                                                                            backgroundColor: sevBg,
                                                                                            color: sevColor,
                                                                                            fontSize: '0.70rem',
                                                                                            fontWeight: 800,
                                                                                            padding: '2px 7px',
                                                                                            borderRadius: '6px',
                                                                                            textTransform: 'uppercase'
                                                                                        }}>
                                                                                            {comment.severity || 'Medium'} Severity
                                                                                        </span>
                                                                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                                                                                            Page {comment.page_number || 1}
                                                                                        </span>
                                                                                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>•</span>
                                                                                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                                                                            by {comment.user_name || 'QC Inspector'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                                        {new Date(comment.created_at).toLocaleString()}
                                                                                    </span>
                                                                                </div>

                                                                                {/* Target Text / Annotation if present */}
                                                                                {comment.target_text && (
                                                                                    <div style={{
                                                                                        fontSize: '0.78rem',
                                                                                        color: '#475569',
                                                                                        backgroundColor: '#f1f5f9',
                                                                                        padding: '6px 10px',
                                                                                        borderRadius: '6px',
                                                                                        marginBottom: '8px',
                                                                                        borderLeft: '3px solid #f97316'
                                                                                    }}>
                                                                                        <strong>Highlighted text / area:</strong> "{comment.target_text}"
                                                                                    </div>
                                                                                )}

                                                                                {/* Issue Comment Text */}
                                                                                <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600, lineHeight: 1.45, marginBottom: '10px' }}>
                                                                                    {comment.comment_text}
                                                                                </div>

                                                                                {/* Reply Thread */}
                                                                                {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', paddingLeft: '12px', borderLeft: '2px solid #cbd5e1' }}>
                                                                                        {comment.replies.map((r: any) => (
                                                                                            <div key={r.reply_id} style={{ fontSize: '0.78rem', color: '#334155' }}>
                                                                                                <strong style={{ color: '#0f172a' }}>{r.user_name} ({r.user_role}):</strong> {r.reply_text}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}

                                                                                {/* Quick Reply & Rectify Box */}
                                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Describe rectification (e.g. Corrected dimension on page 2)..."
                                                                                        value={replyTextMap[comment.comment_id] || ''}
                                                                                        onChange={(e) => setReplyTextMap(prev => ({ ...prev, [comment.comment_id]: e.target.value }))}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSendReply(comment.comment_id);
                                                                                        }}
                                                                                        style={{
                                                                                            flex: 1,
                                                                                            minWidth: '220px',
                                                                                            padding: '6px 10px',
                                                                                            borderRadius: '6px',
                                                                                            border: '1px solid #cbd5e1',
                                                                                            fontSize: '0.78rem',
                                                                                            outline: 'none',
                                                                                            backgroundColor: '#ffffff'
                                                                                        }}
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => handleSendReply(comment.comment_id)}
                                                                                        disabled={postingReplyId === comment.comment_id || !(replyTextMap[comment.comment_id] || '').trim()}
                                                                                        style={{
                                                                                            padding: '6px 12px',
                                                                                            borderRadius: '6px',
                                                                                            backgroundColor: '#0f172a',
                                                                                            color: '#ffffff',
                                                                                            border: 'none',
                                                                                            cursor: 'pointer',
                                                                                            fontSize: '0.76rem',
                                                                                            fontWeight: 700,
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px'
                                                                                        }}
                                                                                    >
                                                                                        {postingReplyId === comment.comment_id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                                                        Reply
                                                                                    </button>

                                                                                    {comment.status !== 'resolved' && comment.status !== 'approved' && (
                                                                                        <button
                                                                                            onClick={() => handleResolveComment(comment.comment_id)}
                                                                                            disabled={resolvingCommentId === comment.comment_id}
                                                                                            style={{
                                                                                                padding: '6px 12px',
                                                                                                borderRadius: '6px',
                                                                                                backgroundColor: '#16a34a',
                                                                                                color: '#ffffff',
                                                                                                border: 'none',
                                                                                                cursor: 'pointer',
                                                                                                fontSize: '0.76rem',
                                                                                                fontWeight: 800,
                                                                                                display: 'flex',
                                                                                                alignItems: 'center',
                                                                                                gap: '4px',
                                                                                                boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)'
                                                                                            }}
                                                                                            title="Post rectification note and mark this issue as resolved"
                                                                                        >
                                                                                            {resolvingCommentId === comment.comment_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                                                            Mark Resolved
                                                                                        </button>
                                                                                    )}

                                                                                    {comment.status === 'resolved' && (
                                                                                        <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                                            <CheckCircle2 size={13} /> Rectified &amp; Resolved
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f8fafc'
                }}>
                    <span style={{ fontSize: '0.80rem', color: '#64748b' }}>
                        When corrections are complete, click <strong>Send to QC</strong> to generate Version {Number(displayVersion) + 1}.
                    </span>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#334155',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>

                        {onGoToQuotation && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onGoToQuotation();
                                }}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#ea580c',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
                                }}
                            >
                                <CornerDownRight size={14} /> Go to Quotation &amp; Edit
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
