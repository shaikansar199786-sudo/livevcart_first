import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { QuotePdfDocument } from '../pages/PrintQuoteView';
import { PdfDocumentViewer } from './PdfDocumentViewer';

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

if (typeof window !== 'undefined' && pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}
import {
    Folder,
    FileText,
    Upload,
    Plus,
    X,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ShieldCheck,
    MessageSquare,
    Eye,
    Clock,
    Download,
    Edit3,
    Trash2,
    Send
} from 'lucide-react';
import { QCRejectDetailsModal } from './QCRejectDetailsModal';

interface QualityCheckTabProps {
    projectId: string | number;
    project?: any;
}

interface QCFolder {
    folder_id: number;
    name: string;
    version_number?: any;
    status?: string;
    pm_status?: string | null;
    pm_notes?: string | null;
    pm_reviewer_name?: string | null;
    pm_reviewed_at?: string | null;
    final_qc_approved?: number | boolean;
    final_qc_reviewer_name?: string | null;
    final_qc_approved_at?: string | null;
    created_at: string;
}

interface QCFile {
    file_id: number;
    folder_id: number;
    quote_id?: number;
    file_name: string;
    file_path: string;
    file_type: string;
    uploader_name: string;
    status: 'pending_review' | 'under_review' | 'approved' | 'changes_requested';
    revision_number?: number;
    parent_file_id?: number;
    reviewer_name?: string;
    reviewer_id?: string;
    uploaded_at: string;
}

interface QCReply {
    reply_id: number;
    comment_id: number;
    user_name: string;
    user_role: string;
    reply_text: string;
    created_at: string;
}

interface QCComment {
    comment_id: number;
    file_id: number;
    project_id: number;
    page_number: number;
    user_name: string;
    severity?: 'low' | 'medium' | 'high' | string;
    box_x?: number | string;
    box_y?: number | string;
    box_w?: number | string;
    box_h?: number | string;
    target_text?: string;
    comment_text: string;
    status: 'open' | 'resolved' | 'reopen' | 'approved' | string;
    created_at: string;
    replies?: QCReply[];
}

export const QualityCheckTab: React.FC<QualityCheckTabProps> = ({ projectId, project }) => {
    const effectiveProjectId = project?.project_id || projectId || project?.project_code || project?.manual_client_id || project?.id;
    const { user } = useAuth();
    const uRole = String(user?.role || '').toLowerCase();
    const isDesigner = ['d1', 'd2', 'designer', 'associate_designer', 'graphic_designer', 'gd'].includes(uRole);
    const canApproveQC = !isDesigner && ([
        'qc',
        'qc_inspector',
        'quality_inspector',
        'quality_check',
        'site_inspector',
        'site_inspection',
        'site_manager',
        'site_engineer',
        'engineer',
        'engineering',
        'admin',
        'superadmin',
        'super_admin',
        'project_head',
        'project_manager',
        'pm'
    ].includes(uRole) || uRole.includes('admin') || uRole.includes('qc') || uRole.includes('inspector') || uRole.includes('engineer'));

    // Access permission for Edit & Delete options in QC tab: ONLY Admin, Design Manager, and Business Manager
    const canManageQCVersionsAndFiles = Boolean(
        // 1. Admin / Owner / Superadmin
        uRole === 'admin' || uRole.includes('admin') || uRole.includes('owner') || Boolean(user?.is_admin) ||
        // 2. Design Manager ('manager' is the Design Manager role in the system, plus variants)
        ['manager', 'design_manager', 'designer_manager', 'dm'].includes(uRole) || uRole.includes('design_manager') ||
        // 3. Business Manager (includes business_manager, business_associate, bm, ba)
        ['business_manager', 'business_associate', 'bm', 'ba'].includes(uRole) || uRole.includes('business_manager')
    );
    const canDeleteVersion = canManageQCVersionsAndFiles;

    const [folders, setFolders] = useState<QCFolder[]>([]);
    const [files, setFiles] = useState<QCFile[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [filesLoading, setFilesLoading] = useState(false);

    // Modal state for creating new QC folder
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [submittingFolder, setSubmittingFolder] = useState(false);

    // File Upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Version History State
    const [fileVersionsMap, setFileVersionsMap] = useState<Record<number, QCFile[]>>({});
    const [openVersionMenuId, setOpenVersionMenuId] = useState<number | null>(null);

    // Document Grid Filter State
    const [gridFilter, setGridFilter] = useState<'all' | 'pending_review' | 'under_review' | 'changes_requested' | 'approved' | 'resolved' | 'reopened'>('all');
    const [allCommentsMap, setAllCommentsMap] = useState<Record<number, QCComment[]>>({});

    // Full-Screen Preview File Modal State
    const [previewFile, setPreviewFile] = useState<QCFile | null>(null);
    const [activePage, setActivePage] = useState<number>(1);
    const [showAllPages, setShowAllPages] = useState<boolean>(false);
    const [pdfTotalPages, setPdfTotalPages] = useState<number>(5);

    // PDF Text Highlight Overlay State
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number; page?: number } | null>(null);
    const [flashingCommentId, setFlashingCommentId] = useState<number | null>(null);
    const [domReady, setDomReady] = useState<number>(0);
    const documentViewerRef = useRef<HTMLDivElement>(null);

    // PDF Comments State
    const [comments, setComments] = useState<QCComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [pageFilter, setPageFilter] = useState<string>('all');
    const [expandedPages, setExpandedPages] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (previewFile) {
            const raf = requestAnimationFrame(() => setDomReady(v => v + 1));
            const t1 = setTimeout(() => setDomReady(v => v + 1), 150);
            const t2 = setTimeout(() => setDomReady(v => v + 1), 400);
            return () => {
                cancelAnimationFrame(raf);
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [previewFile, activePage, comments]);

    // Add Comment form
    const [commentPageNum, setCommentPageNum] = useState<number | string>('');
    const [selectedTargetText, setSelectedTargetText] = useState('');
    const [commentRemark, setCommentRemark] = useState('');
    const [commentSeverity, setCommentSeverity] = useState<'low' | 'medium' | 'high'>('medium');
    const [addingComment, setAddingComment] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Replies & Comment History state
    const [replyingCommentId, setReplyingCommentId] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [postingReply, setPostingReply] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({});

    // Folder & Files State
    const [allProjectFiles, setAllProjectFiles] = useState<QCFile[]>([]);

    // Rejection & PM Workflow States
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectModalFolderId, setRejectModalFolderId] = useState<number | null>(null);
    const [sendingPM, setSendingPM] = useState(false);
    const isPMOrAdmin = ['pm', 'project_manager', 'admin', 'superadmin', 'super_admin', 'project_head'].includes(uRole) || uRole.includes('admin') || uRole.includes('pm') || uRole.includes('manager');

    useEffect(() => {
        setActiveFolderId(null);
        fetchFolders(false);
        fetchAllProjectFiles();
        const interval = setInterval(() => {
            fetchFolders(true);
            fetchAllProjectFiles();
        }, 8000);

        const handleQCChange = () => {
            fetchFolders(true);
            fetchAllProjectFiles();
        };
        window.addEventListener('qc_status_changed', handleQCChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('qc_status_changed', handleQCChange);
        };
    }, [effectiveProjectId]);

    useEffect(() => {
        if (activeFolderId) {
            fetchFiles(activeFolderId);
        } else {
            setFiles([]);
        }
    }, [activeFolderId]);

    const fetchFolders = async (isBackground = false) => {
        if (!isBackground && folders.length === 0) setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/qc/folders?project_id=${effectiveProjectId}`);
            if (res.data.success) {
                const fetchedFolders: QCFolder[] = res.data.data || [];
                setFolders(fetchedFolders);
                if (fetchedFolders.length > 0) {
                    // Backend returns folders sorted by highest version number first (e.g. Version 7, Version 6...)
                    const versionFolder = fetchedFolders.find(f => f.name.toLowerCase().includes('version') || f.name.toLowerCase().includes('quote')) || fetchedFolders[0];
                    const targetFolderId = versionFolder ? versionFolder.folder_id : fetchedFolders[0].folder_id;
                    setActiveFolderId(prev => {
                        // Only auto-select target folder on initial load, or if the previously selected folder was deleted:
                        if (!prev || !fetchedFolders.some(f => f.folder_id === prev)) {
                            return targetFolderId;
                        }
                        // When user selects a specific version (e.g. Version 1), stay on it without glitching back:
                        return prev;
                    });
                }
            }
        } catch (err) {
            console.error('Failed to fetch QC folders', err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const fetchAllProjectFiles = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/qc/files?project_id=${effectiveProjectId}`);
            if (res.data.success) {
                const fetchedFiles: QCFile[] = res.data.data || [];
                setAllProjectFiles(fetchedFiles);
                fetchedFiles.forEach(f => fetchCommentsForGrid(f.file_id));
            }
        } catch (err) {
            console.error('Failed to fetch all project QC files', err);
        }
    };

    const fetchFiles = async (folderId: number) => {
        setFilesLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/qc/files?project_id=${effectiveProjectId}&folder_id=${folderId}`);
            if (res.data.success) {
                const fetchedFiles: QCFile[] = res.data.data || [];
                setFiles(fetchedFiles);
                // Pre-fetch comments for each file to support 'resolved' grid filter
                fetchedFiles.forEach(f => fetchCommentsForGrid(f.file_id));
                fetchAllProjectFiles();
            }
        } catch (err) {
            console.error('Failed to fetch QC files', err);
        } finally {
            setFilesLoading(false);
        }
    };

    const fetchCommentsForGrid = async (fileId: number) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/qc/comments?file_id=${fileId}`);
            if (res.data.success) {
                setAllCommentsMap(prev => ({ ...prev, [fileId]: res.data.data || [] }));
            }
        } catch (err) { }
    };

    const fetchVersions = async (fileId: number) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/qc/versions?file_id=${fileId}`);
            if (res.data.success) {
                setFileVersionsMap(prev => ({ ...prev, [fileId]: res.data.data || [] }));
            }
        } catch (err) {
            console.error('Failed to fetch versions', err);
        }
    };

    const detectPdfPageCount = async (file: QCFile) => {
        if (file.file_name?.match(/\.(png|jpg|jpeg|gif|webp)$/i) || file.file_type?.startsWith('image/')) {
            setPdfTotalPages(1);
            return;
        }

        if (file.quote_id || file.file_type === 'quote_pdf') {
            setPdfTotalPages(4);
            return;
        }

        const url = getFileUrl(file);

        // 1. Try pdf-lib first (pure JS, offline/local safe, no external worker)
        try {
            const res = await axios.get(url, { responseType: 'arraybuffer' });
            if (res.data) {
                const pdfDoc = await PDFDocument.load(res.data, { ignoreEncryption: true });
                const count = pdfDoc.getPageCount();
                if (count && count > 0) {
                    setPdfTotalPages(count);
                    return;
                }
            }
        } catch (e1) {
            console.warn('[QC] pdf-lib page detection fallback:', e1);
        }

        // 2. Fallback to pdfjs-dist
        try {
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            if (pdf && pdf.numPages > 0) {
                setPdfTotalPages(pdf.numPages);
                return;
            }
        } catch (e2) {
            console.warn('[QC] pdfjs page detection fallback:', e2);
        }

        // 3. Fallback default
        setPdfTotalPages(4);
    };

    const handleOpenFileWithLock = async (file: QCFile) => {
        detectPdfPageCount(file);
        setPageFilter('open');
        try {
            await axios.post(`${API_BASE_URL}/qc/lock-inspector`, {
                file_id: file.file_id,
                user_name: user?.name || 'QC Inspector',
                user_id: user?.user_id || (user as any)?.id
            });

            // Update file in local state if status was pending_review
            const updatedFile = { ...file, status: file.status === 'pending_review' ? ('under_review' as const) : file.status };
            setPreviewFile(updatedFile);
            setActivePage(1);
            setCommentPageNum('');
            fetchComments(file.file_id);
        } catch (err) {
            // Fallback open if lock request fails
            setPreviewFile(file);
            setActivePage(1);
            setCommentPageNum('');
            fetchComments(file.file_id);
        }
    };

    const fetchComments = async (fileId: number) => {
        setCommentsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/qc/comments?file_id=${fileId}`);
            if (res.data.success) {
                const fetched: QCComment[] = res.data.data || [];
                setComments(fetched);
                setAllCommentsMap(prev => ({ ...prev, [fileId]: fetched }));
            }
        } catch (err) {
            console.error('Failed to fetch QC comments', err);
        } finally {
            setCommentsLoading(false);
        }
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        setSubmittingFolder(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/create-folder`, {
                project_id: effectiveProjectId,
                name: newFolderName.trim()
            });

            if (res.data.success) {
                setNewFolderName('');
                setShowFolderModal(false);
                fetchFolders();
            } else {
                alert('Failed to create folder: ' + res.data.message);
            }
        } catch (err) {
            alert('Failed to create QC folder');
        } finally {
            setSubmittingFolder(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !activeFolderId) return;
        const selectedFiles = Array.from(e.target.files);

        setUploading(true);
        try {
            for (const fileToUpload of selectedFiles) {
                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('project_id', String(effectiveProjectId || projectId));
                formData.append('folder_id', String(activeFolderId));
                formData.append('uploader_name', user?.name || 'User');

                await axios.post(`${API_BASE_URL}/qc/upload-file`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            if (activeFolderId) {
                await fetchFiles(activeFolderId);
            }
            await fetchAllProjectFiles();
        } catch (err) {
            alert('Failed to upload file(s) to QC');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const dragStartRef = useRef<{ x: number; y: number; page: number; pageEl: HTMLElement } | null>(null);

    const handleViewerMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const pageEl = target?.closest('[id^="pdf-page-"]') as HTMLElement | null;
        if (pageEl && pageEl.id) {
            const parsed = parseInt(pageEl.id.replace('pdf-page-', ''), 10);
            if (!isNaN(parsed) && parsed > 0) {
                dragStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    page: parsed,
                    pageEl
                };
            }
        }
    };

    const handleTextSelection = (e?: React.MouseEvent) => {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';

        if (text && sel && !sel.isCollapsed) {
            try {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    let targetEl: HTMLElement | null = null;
                    if (range.commonAncestorContainer) {
                        targetEl = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                            ? range.commonAncestorContainer.parentElement
                            : range.commonAncestorContainer) as HTMLElement;
                    }

                    const pageEl = targetEl?.closest('[id^="pdf-page-"]') as HTMLElement | null;
                    let detectedPage = activePage;
                    let refRect: DOMRect;

                    if (pageEl && pageEl.id) {
                        const parsedNum = parseInt(pageEl.id.replace('pdf-page-', ''), 10);
                        if (!isNaN(parsedNum) && parsedNum > 0) {
                            detectedPage = parsedNum;
                        }
                        refRect = pageEl.getBoundingClientRect();
                    } else if (documentViewerRef.current) {
                        refRect = documentViewerRef.current.getBoundingClientRect();
                    } else {
                        dragStartRef.current = null;
                        return;
                    }

                    const boxX = ((rect.left - refRect.left) / refRect.width) * 100;
                    const boxY = ((rect.top - refRect.top) / refRect.height) * 100;
                    const boxW = (rect.width / refRect.width) * 100;
                    const boxH = (rect.height / refRect.height) * 100;

                    setSelectionBox({
                        x: Math.round(boxX * 100) / 100,
                        y: Math.round(boxY * 100) / 100,
                        w: Math.round(boxW * 100) / 100,
                        h: Math.round(boxH * 100) / 100,
                        page: detectedPage
                    });

                    setSelectedTargetText(text);
                    setActivePage(detectedPage);
                    setCommentPageNum(detectedPage);
                    dragStartRef.current = null;
                    return;
                }
            } catch (err) { }
        }

        // If no text selected, check if user dragged a box
        if (dragStartRef.current && e) {
            const { x: startX, y: startY, page: dragPage, pageEl } = dragStartRef.current;
            const diffX = e.clientX - startX;
            const diffY = e.clientY - startY;

            if (Math.abs(diffX) > 15 && Math.abs(diffY) > 15) {
                const refRect = pageEl.getBoundingClientRect();
                const left = Math.min(startX, e.clientX);
                const top = Math.min(startY, e.clientY);
                const width = Math.abs(diffX);
                const height = Math.abs(diffY);

                const boxX = Math.max(0, Math.min(100, ((left - refRect.left) / refRect.width) * 100));
                const boxY = Math.max(0, Math.min(100, ((top - refRect.top) / refRect.height) * 100));
                const boxW = Math.min(100 - boxX, (width / refRect.width) * 100);
                const boxH = Math.min(100 - boxY, (height / refRect.height) * 100);

                setSelectionBox({
                    x: Math.round(boxX * 100) / 100,
                    y: Math.round(boxY * 100) / 100,
                    w: Math.round(boxW * 100) / 100,
                    h: Math.round(boxH * 100) / 100,
                    page: dragPage
                });

                if (!selectedTargetText) {
                    setSelectedTargetText(`Marked area on Page ${dragPage}`);
                }
                setActivePage(dragPage);
                setCommentPageNum(dragPage);
            }
        }
        dragStartRef.current = null;
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!previewFile || (!commentRemark.trim() && !selectedTargetText.trim())) return;

        const targetPage = typeof commentPageNum === 'number' && commentPageNum > 0 ? commentPageNum : (selectionBox?.page || activePage);

        setAddingComment(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/add-comment`, {
                file_id: previewFile.file_id,
                project_id: projectId,
                page_number: targetPage,
                target_text: selectedTargetText.trim(),
                comment_text: commentRemark.trim(),
                severity: commentSeverity,
                user_name: user?.name || 'QC Inspector',
                box_x: selectionBox?.x ?? null,
                box_y: selectionBox?.y ?? null,
                box_w: selectionBox?.w ?? null,
                box_h: selectionBox?.h ?? null
            });

            if (res.data.success) {
                setSelectedTargetText('');
                setCommentRemark('');
                setCommentPageNum('');
                setSelectionBox(null);
                fetchComments(previewFile.file_id);
            } else {
                alert('Failed to add issue note: ' + res.data.message);
            }
        } catch (err) {
            alert('Failed to submit QC issue note');
        } finally {
            setAddingComment(false);
        }
    };

    const handleUpdateQCStatus = async (status: 'approved' | 'changes_requested' | 'under_review') => {
        if (!previewFile) return;

        if (status === 'approved') {
            // First check local state
            let currentList = comments;
            // Also fetch latest comments to guarantee no stale state bypass
            try {
                const freshRes = await axios.get(`${API_BASE_URL}/qc/comments?file_id=${previewFile.file_id}`);
                if (freshRes.data && freshRes.data.success && Array.isArray(freshRes.data.data)) {
                    currentList = freshRes.data.data;
                    setComments(currentList);
                    setAllCommentsMap(prev => ({ ...prev, [previewFile.file_id]: currentList }));
                }
            } catch (err) {
                console.error("Error refreshing comments before QC approval", err);
            }

            const unapprovedComments = currentList.filter(c => c.status === 'open' || c.status === 'reopen');
            if (unapprovedComments.length > 0) {
                alert('Cannot approve document: There are open/reopened issues that have not been resolved by the designer yet.');
                return;
            }
        }

        setUpdatingStatus(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/update-status`, {
                file_id: previewFile.file_id,
                status
            });

            if (res.data.success) {
                const updatedFile = { ...previewFile, status };
                setPreviewFile(updatedFile);
                setFiles(prev => prev.map(f => f.file_id === previewFile.file_id ? updatedFile : f));
                if (status === 'approved') {
                    setComments(prev => prev.map(c => c.status === 'resolved' ? { ...c, status: 'approved' } : c));
                }
                fetchFolders();
                fetchAllProjectFiles();
                alert(`QC Status updated to: ${status.replace('_', ' ').toUpperCase()}`);
            } else {
                alert(res.data.message || 'Failed to update status');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating QC status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleUpdateFolderStatus = async (folderId: number, status: 'approved' | 'changes_requested') => {
        let notes = '';
        if (status === 'changes_requested') {
            const promptNotes = window.prompt("Enter rejection observations / remarks for the designer:", "Revisions required as per Quality Check review.");
            if (promptNotes === null) return; // user cancelled
            notes = promptNotes.trim() || 'Revisions required as per Quality Check review.';
        } else if (status === 'approved') {
            const folderFiles = allProjectFiles.filter(f => f.folder_id === folderId);

            if (folderFiles.length === 0) {
                alert('Cannot approve version: This version folder is empty.');
                return;
            }

            let hasUnresolvedComments = false;
            for (const f of folderFiles) {
                const fComments = allCommentsMap[f.file_id] || [];
                const unapprovedCmts = fComments.filter(c => c.status === 'open' || c.status === 'reopen');
                if (unapprovedCmts.length > 0) {
                    hasUnresolvedComments = true;
                    break;
                }
            }
            if (hasUnresolvedComments) {
                alert('Cannot approve version: There are open/reopened issues on files in this version. Designer must resolve them first.');
                return;
            }

            const hasRejectedFiles = folderFiles.some(f => f.status === 'changes_requested' || (f.status as any) === 'rejected');
            if (hasRejectedFiles) {
                alert('Cannot approve version: One or more documents in this version folder have been rejected. Please review them or reject the version.');
                return;
            }

            if (!window.confirm("Are you sure you want to approve this version folder and accept all documents inside it?")) {
                return;
            }
        }

        try {
            const res = await axios.post(`${API_BASE_URL}/qc/update-folder-status`, {
                folder_id: folderId,
                status: status,
                notes: notes,
                user_name: user?.name || 'QC Inspector'
            });
            if (res.data.success) {
                alert(`Version folder status updated to ${status === 'approved' ? 'Approved' : 'Rejected'}!${status === 'changes_requested' ? '\n\nRejection notification email sent to designer.' : ''}`);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status, folderId } }));
                }
                fetchFolders();
                fetchAllProjectFiles();
                if (activeFolderId) fetchFiles(activeFolderId);
            } else {
                alert(res.data.message || 'Failed to update folder status');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating folder status');
        }
    };

    const handleSendToPM = async (folderId: number) => {
        setSendingPM(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/send-to-pm`, {
                folder_id: folderId,
                user_name: user?.name || 'QC Inspector',
                project_id: effectiveProjectId
            });
            if (res.data.success) {
                alert(res.data.message || 'Version sent to PM successfully!');
                fetchFolders();
                fetchAllProjectFiles();
            } else {
                alert('Failed to send to PM: ' + res.data.message);
            }
        } catch (err: any) {
            alert('Error sending to PM: ' + (err?.response?.data?.message || err?.message));
        } finally {
            setSendingPM(false);
        }
    };

    const handlePMApprove = async (folderId: number) => {
        if (!window.confirm('Are you sure you want to accept and clear this version for QC Final Approval?')) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/pm-approve`, {
                folder_id: folderId,
                user_name: user?.name || 'Project Manager',
                project_id: effectiveProjectId
            });
            if (res.data.success) {
                alert('🎉 ' + res.data.message);
                fetchFolders();
                fetchAllProjectFiles();
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'pm_approved', folderId } }));
                }
            } else {
                alert('Failed: ' + res.data.message);
            }
        } catch (err: any) {
            alert('Error approving version: ' + (err?.response?.data?.message || err?.message));
        }
    };

    const handlePMReject = async (folderId: number) => {
        const notes = window.prompt('Please enter notes / corrections requested by PM:');
        if (notes === null) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/pm-reject`, {
                folder_id: folderId,
                user_name: user?.name || 'Project Manager',
                notes: notes,
                project_id: effectiveProjectId
            });
            if (res.data.success) {
                alert(res.data.message);
                fetchFolders();
                fetchAllProjectFiles();
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'pm_rejected', folderId } }));
                }
            } else {
                alert('Failed: ' + res.data.message);
            }
        } catch (err: any) {
            alert('Error rejecting: ' + (err?.response?.data?.message || err?.message));
        }
    };

    const handleQCFinalApprove = async (folderId: number) => {
        if (!window.confirm('Are you sure you want to issue Final QC Approval? This will officially lock this quotation as the Final Version and seal the project budget.')) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/final-qc-approve`, {
                folder_id: folderId,
                user_name: user?.name || 'QC Inspector'
            });
            if (res.data.success) {
                alert(res.data.message);
                fetchFolders();
                fetchAllProjectFiles();
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'approved', folderId } }));
                }
            } else {
                alert('Failed: ' + res.data.message);
            }
        } catch (err: any) {
            alert('Error issuing Final QC Approval: ' + (err?.response?.data?.message || err?.message));
        }
    };

    const handleQCFinalReject = async (folderId: number) => {
        const notes = window.prompt('Please enter rejection notes for corrections:');
        if (notes === null) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/final-qc-reject`, {
                folder_id: folderId,
                user_name: user?.name || 'QC Inspector',
                notes: notes
            });
            if (res.data.success) {
                alert(res.data.message);
                fetchFolders();
                fetchAllProjectFiles();
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'qc_rejected', folderId } }));
                }
            } else {
                alert('Failed: ' + res.data.message);
            }
        } catch (err: any) {
            alert('Error rejecting: ' + (err?.response?.data?.message || err?.message));
        }
    };

    const handleRenameFolder = async (e: React.MouseEvent, folderId: number, currentName: string) => {
        e.stopPropagation();
        if (!canManageQCVersionsAndFiles) {
            alert('Access Denied: Only Admin, Design Manager, and Business Manager can rename version folders.');
            return;
        }
        const newName = window.prompt("Rename QC Folder:", currentName);
        if (!newName || !newName.trim() || newName.trim() === currentName) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/qc/rename-folder`, {
                folder_id: folderId,
                name: newName.trim(),
                user_id: user?.user_id,
                user_role: user?.role,
                is_admin: user?.is_admin || user?.role === 'admin'
            });
            if (res.data.success) {
                alert('Folder renamed successfully!');
                fetchFolders();
            } else {
                alert('Failed to rename folder: ' + res.data.message);
            }
        } catch (err) {
            alert('Error renaming folder');
        }
    };

    const handleDeleteFolder = async (e: React.MouseEvent, folderId: number, name: string) => {
        e.stopPropagation();
        if (!canManageQCVersionsAndFiles) {
            alert('Access Denied: Only Admin, Design Manager, and Business Manager can delete version folders.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete version "${name}" and all contained documents/comments?`)) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/qc/delete-folder`, {
                folder_id: folderId,
                user_id: user?.user_id,
                user_role: user?.role,
                is_admin: user?.is_admin || user?.role === 'admin'
            });
            if (res.data.success) {
                alert('Version deleted successfully!');
                if (activeFolderId === folderId) setActiveFolderId(null);
                fetchFolders();
                fetchAllProjectFiles();
            } else {
                alert('Failed to delete version: ' + res.data.message);
            }
        } catch (err) {
            alert('Error deleting version');
        }
    };

    const handleRenameFile = async (e: React.MouseEvent, fileId: number, currentName: string) => {
        e.stopPropagation();
        if (!canManageQCVersionsAndFiles) {
            alert('Access Denied: Only Admin, Design Manager, and Business Manager can rename files.');
            return;
        }
        const newName = window.prompt("Rename Attached File:", currentName);
        if (!newName || !newName.trim() || newName.trim() === currentName) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/qc/rename-file`, {
                file_id: fileId,
                name: newName.trim(),
                user_id: user?.user_id,
                user_role: user?.role,
                is_admin: user?.is_admin || user?.role === 'admin'
            });
            if (res.data.success) {
                alert('File renamed successfully!');
                if (activeFolderId) fetchFiles(activeFolderId);
                fetchAllProjectFiles();
            } else {
                alert('Failed to rename file: ' + res.data.message);
            }
        } catch (err) {
            alert('Error renaming file');
        }
    };

    const handleDeleteFile = async (e: React.MouseEvent, fileId: number, fileName: string) => {
        e.stopPropagation();
        if (!canManageQCVersionsAndFiles) {
            alert('Access Denied: Only Admin, Design Manager, and Business Manager can delete files.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete file "${fileName}"?`)) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/qc/delete-file`, {
                file_id: fileId,
                user_id: user?.user_id,
                user_role: user?.role,
                is_admin: user?.is_admin || user?.role === 'admin'
            });
            if (res.data.success) {
                alert('File deleted successfully!');
                if (activeFolderId) fetchFiles(activeFolderId);
                fetchAllProjectFiles();
            } else {
                alert('Failed to delete file: ' + res.data.message);
            }
        } catch (err) {
            alert('Error deleting file');
        }
    };

    const getFolderAggregateStatus = (folderFiles: QCFile[], folder?: QCFolder): 'pending_review' | 'under_review' | 'approved' | 'changes_requested' | 'pm_rejected' => {
        if (folder?.pm_status === 'pm_rejected') {
            return 'pm_rejected';
        }
        // Folder-level status is changes_requested or approved ONLY when officially selected and saved for the folder
        if ((folder as any)?.status === 'changes_requested' || (folder as any)?.status === 'rejected') {
            return 'changes_requested';
        }
        if ((folder as any)?.status === 'approved' || (folder as any)?.final_qc_approved === 1) {
            return 'approved';
        }
        if (!folderFiles || folderFiles.length === 0) return 'pending_review';

        // When files inside have been reviewed (approved or rejected), folder badge stays Under Review until QC manually finalizes the folder
        const hasReviewedFiles = folderFiles.some(f => f.status === 'approved' || f.status === 'changes_requested' || (f.status as any) === 'rejected');
        if (hasReviewedFiles) {
            return 'under_review';
        }

        // If no files have been reviewed yet -> Pending Review
        return 'pending_review';
    };

    const handleUpdateCommentStatus = async (commentId: number, newStatus: 'open' | 'resolved' | 'reopen' | 'approved') => {
        if (newStatus === 'resolved') {
            const targetComment = comments.find(c => c.comment_id === commentId);
            const hasReplies = targetComment && Array.isArray(targetComment.replies) && targetComment.replies.length > 0;
            if (!hasReplies) {
                alert('A reply is required before marking this issue as resolved. Please post a reply first.');
                setReplyingCommentId(commentId);
                return;
            }
        }
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/resolve-comment`, {
                comment_id: commentId,
                status: newStatus
            });
            if (res.data.success) {
                setComments(prev => prev.map(c => c.comment_id === commentId ? { ...c, status: newStatus } : c));
                setAllCommentsMap(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(fid => {
                        next[Number(fid)] = next[Number(fid)].map(c => c.comment_id === commentId ? { ...c, status: newStatus } : c);
                    });
                    return next;
                });
            } else {
                alert('Failed to update comment status: ' + res.data.message);
            }
        } catch (err) {
            alert('Error updating comment status');
        }
    };

    const handleAddReply = async (commentId: number) => {
        if (!replyText.trim()) return;

        setPostingReply(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/add-reply`, {
                comment_id: commentId,
                reply_text: replyText.trim(),
                user_name: user?.name || 'Designer',
                user_role: user?.role || 'designer'
            });

            if (res.data.success) {
                const newReply: QCReply = {
                    reply_id: res.data.reply_id || Date.now(),
                    comment_id: commentId,
                    user_name: user?.name || 'Designer',
                    user_role: user?.role || 'designer',
                    reply_text: replyText.trim(),
                    created_at: new Date().toISOString()
                };

                // Automatically resolve comment upon reply
                try {
                    await axios.post(`${API_BASE_URL}/qc/resolve-comment`, {
                        comment_id: commentId,
                        status: 'resolved'
                    });
                } catch (e) { }

                setComments(prev => prev.map(c => {
                    if (c.comment_id === commentId) {
                        return {
                            ...c,
                            status: 'resolved',
                            replies: [...(c.replies || []), newReply]
                        };
                    }
                    return c;
                }));
                setAllCommentsMap(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(fid => {
                        next[Number(fid)] = next[Number(fid)].map(c => c.comment_id === commentId ? { ...c, status: 'resolved', replies: [...(c.replies || []), newReply] } : c);
                    });
                    return next;
                });
                setReplyText('');
                setReplyingCommentId(null);
                if (previewFile) {
                    fetchComments(previewFile.file_id);
                }
            } else {
                alert('Failed to post reply: ' + res.data.message);
            }
        } catch (err) {
            alert('Error posting reply');
        } finally {
            setPostingReply(false);
        }
    };

    const toggleHistory = (commentId: number) => {
        setExpandedHistory(prev => ({ ...prev, [commentId]: !prev[commentId] }));
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pm_rejected':
                return <span style={{ backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fda4af', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Rejected by PM</span>;
            case 'approved':
                return <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Approved</span>;
            case 'changes_requested':
            case 'rejected':
                return <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Rejected</span>;
            case 'under_review':
                return <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Under Review</span>;
            default:
                return <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Pending</span>;
        }
    };

    const getResolutionStatusBadge = (cmts: QCComment[], isTargetRejected: boolean = true) => {
        if (!isTargetRejected || !cmts || cmts.length === 0) return null;
        const openCount = cmts.filter(c => c.status === 'open' || c.status === 'reopen').length;
        const resolvedCount = cmts.filter(c => c.status === 'resolved' || c.status === 'approved').length;

        if (openCount > 0) {
            return (
                <span
                    style={{
                        backgroundColor: '#fff7ed',
                        color: '#ea580c',
                        border: '1px solid #fed7aa',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                    }}
                    title={`${openCount} open issue(s) remaining`}
                >
                    <Clock size={12} /> {openCount > 1 ? `${openCount} Open` : 'Open'}
                </span>
            );
        }

        if (resolvedCount > 0) {
            return (
                <span
                    style={{
                        backgroundColor: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                    }}
                    title="All comments resolved by designer"
                >
                    <CheckCircle2 size={12} /> Resolved
                </span>
            );
        }

        return null;
    };

    const getFileUrl = (file: QCFile) => {
        if (file.quote_id || file.file_path.includes('print-quote')) {
            const qid = file.quote_id || file.file_path.split('print-quote/')[1];
            const baseUrl = window.location.href.split('#')[0];
            return `${baseUrl}#/print-quote/${qid}`;
        }
        if (file.file_path.startsWith('http://') || file.file_path.startsWith('https://')) {
            return file.file_path;
        }
        const cleanPath = file.file_path.replace(/^\/+/, '');
        return `${API_BASE_URL.replace(/\/api\/?$/, '')}/${cleanPath}`;
    };

    const filteredComments = comments.filter(c => {
        if (previewFile && c.file_id && Number(c.file_id) !== Number(previewFile.file_id)) return false;
        if (pageFilter === 'current') return c.page_number === activePage;
        if (pageFilter === 'open') return c.status === 'open' || c.status === 'reopen';
        if (pageFilter === 'resolved') return c.status === 'resolved';
        if (pageFilter === 'reopen') return c.status === 'reopen';
        if (pageFilter === 'approved') return c.status === 'approved';
        if (pageFilter === 'high') return (c.severity || '').toLowerCase() === 'high' || (c.severity || '').toLowerCase() === 'critical';
        return true;
    });

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" /></div>;
    }

    const activeFolder = folders.find(f => f.folder_id === activeFolderId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* Top Container: Folders Sidebar & Document Cards Grid */}
            <div style={{ display: 'flex', gap: '24px', height: '540px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>

                {/* Sidebar: Folders */}
                <div style={{ width: '320px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Folders</h3>
                        <button
                            onClick={() => setShowFolderModal(true)}
                            style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#111827', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Create New QC Folder"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                        {folders.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginTop: '40px' }}>
                                No QC folders yet.<br />Create one to organize documents.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[...folders].sort((a, b) => (b.version_number || 0) - (a.version_number || 0)).map(folder => {
                                    const isActive = activeFolderId === folder.folder_id;
                                    const folderFiles = allProjectFiles.filter(f => f.folder_id === folder.folder_id);
                                    const folderAggregateStatus = getFolderAggregateStatus(folderFiles, folder);
                                    const isFolderRejected = folderAggregateStatus === 'changes_requested' || folderAggregateStatus === 'pm_rejected' || (folder as any).status === 'changes_requested';
                                    const folderComments = folderFiles.flatMap(f => allCommentsMap[f.file_id] || (previewFile?.file_id === f.file_id ? comments : []));
                                    return (
                                        <div
                                            key={folder.folder_id}
                                            onClick={() => setActiveFolderId(folder.folder_id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px',
                                                borderRadius: '8px', border: isActive ? '1.5px solid #fed7aa' : '1px solid transparent', cursor: 'pointer',
                                                backgroundColor: isActive ? '#fff7ed' : 'transparent',
                                                color: isActive ? '#ea580c' : '#4b5563',
                                                fontWeight: isActive ? 800 : 500,
                                                textAlign: 'left', transition: 'all 0.2s', gap: '8px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                                                <Folder size={18} fill={isActive ? '#ea580c' : 'none'} color={isActive ? '#ea580c' : '#64748b'} style={{ flexShrink: 0 }} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 800 : 600 }}>{folder.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                {/* DUAL BADGE: Rule 4 & 5 Folder Aggregate Badge */}
                                                {getStatusBadge(folderAggregateStatus)}
                                                {getResolutionStatusBadge(folderComments, isFolderRejected)}
                                                {canManageQCVersionsAndFiles && (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleRenameFolder(e, folder.folder_id, folder.name)}
                                                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}
                                                            title="Rename folder"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteFolder(e, folder.folder_id, folder.name)}
                                                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}
                                                            title="Delete version folder"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Area: Document Cards Grid */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                    {activeFolderId ? (
                        <>
                            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0c1527' }}>
                                        {activeFolder?.name || 'QC Documents'}
                                    </h3>
                                    {/* DUAL BADGE: Rule 4 & 5 Folder Aggregate Badge */}
                                    {getStatusBadge(getFolderAggregateStatus(allProjectFiles.filter(f => f.folder_id === activeFolderId), activeFolder))}
                                    {(() => {
                                        const folderFiles = allProjectFiles.filter(f => f.folder_id === activeFolderId);
                                        const folderAggregateStatus = getFolderAggregateStatus(folderFiles, activeFolder);
                                        const isFolderRejected = folderAggregateStatus === 'changes_requested' || folderAggregateStatus === 'pm_rejected' || (activeFolder as any)?.status === 'changes_requested';
                                        const folderComments = folderFiles.flatMap(f => allCommentsMap[f.file_id] || (previewFile?.file_id === f.file_id ? comments : []));
                                        return getResolutionStatusBadge(folderComments, isFolderRejected);
                                    })()}

                                    {/* VIEW REJECT DETAILS BUTTON when Rejected / Changes Requested or PM Rejected */}
                                    {(getFolderAggregateStatus(allProjectFiles.filter(f => f.folder_id === activeFolderId), activeFolder) === 'changes_requested' || getFolderAggregateStatus(allProjectFiles.filter(f => f.folder_id === activeFolderId), activeFolder) === 'pm_rejected') && (
                                        <button
                                            onClick={() => {
                                                setRejectModalFolderId(activeFolderId);
                                                setShowRejectModal(true);
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: activeFolder?.pm_status === 'pm_rejected' ? '1.5px solid #fda4af' : '1.5px solid #fecaca',
                                                backgroundColor: activeFolder?.pm_status === 'pm_rejected' ? '#fff1f2' : '#fef2f2',
                                                color: activeFolder?.pm_status === 'pm_rejected' ? '#9f1239' : '#b91c1c',
                                                fontWeight: 800,
                                                fontSize: '0.78rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.1)'
                                            }}
                                            title={activeFolder?.pm_status === 'pm_rejected' ? "View PM rejection notes and reopened comments" : "View detailed QC correction remarks and file rejection breakdown"}
                                        >
                                            <AlertTriangle size={14} color={activeFolder?.pm_status === 'pm_rejected' ? '#e11d48' : '#dc2626'} />
                                            {activeFolder?.pm_status === 'pm_rejected' ? 'View PM Reject Details' : 'View Reject Details'}
                                        </button>
                                    )}

                                    {/* FOLDER-LEVEL ACTION BUTTONS: Total Accept & Reject */}
                                    {canApproveQC && (() => {
                                        const isFolderOfficiallyRejected = (activeFolder as any)?.status === 'changes_requested' || 
                                            (activeFolder as any)?.status === 'rejected' || 
                                            activeFolder?.pm_status === 'pm_rejected' || 
                                            activeFolder?.pm_status === 'qc_rejected';
                                        const isFolderOfficiallyApproved = (activeFolder as any)?.status === 'approved' || 
                                            (activeFolder as any)?.final_qc_approved === 1;

                                        // If already approved, do not show Accept/Reject (PM workflow is handled below)
                                        if (isFolderOfficiallyApproved) return null;

                                        return (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                                                {/* Total Accept: appears outside for QC to accept the version (disappears once officially rejected) */}
                                                {!isFolderOfficiallyRejected && (
                                                    <button
                                                        type="button"
                                                        onClick={() => activeFolderId && handleUpdateFolderStatus(activeFolderId, 'approved')}
                                                        style={{
                                                            padding: '6px 13px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #86efac',
                                                            backgroundColor: '#f0fdf4',
                                                            color: '#166534',
                                                            fontWeight: 800,
                                                            fontSize: '0.78rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            boxShadow: '0 1px 3px rgba(22, 101, 52, 0.1)'
                                                        }}
                                                        title="Accept all documents in this version folder"
                                                    >
                                                        <CheckCircle2 size={14} color="#16a34a" /> Total Accept
                                                    </button>
                                                )}

                                                {/* Reject: appears outside for QC to manually reject the version folder */}
                                                <button
                                                    type="button"
                                                    onClick={() => activeFolderId && handleUpdateFolderStatus(activeFolderId, 'changes_requested')}
                                                    style={{
                                                        padding: '6px 13px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #fca5a5',
                                                        backgroundColor: '#fef2f2',
                                                        color: '#991b1b',
                                                        fontWeight: 800,
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        boxShadow: '0 1px 3px rgba(153, 27, 27, 0.1)'
                                                    }}
                                                    title={isFolderOfficiallyRejected ? "Update rejection observations & re-notify designer via email" : "Reject this version folder, request changes, and notify designer via email"}
                                                >
                                                    <XCircle size={14} color="#dc2626" /> Reject
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {/* PM WORKFLOW MILESTONE: When ALL files in folder are Approved */}
                                    {getFolderAggregateStatus(allProjectFiles.filter(f => f.folder_id === activeFolderId), activeFolder) === 'approved' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                                            {(!activeFolder?.pm_status || activeFolder?.pm_status === 'pm_rejected' || activeFolder?.pm_status === 'qc_rejected') && (
                                                <button
                                                    onClick={() => activeFolderId && handleSendToPM(activeFolderId)}
                                                    disabled={sendingPM}
                                                    style={{
                                                        padding: '6px 14px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        backgroundColor: '#4f46e5',
                                                        color: '#ffffff',
                                                        fontWeight: 800,
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                                                    }}
                                                    title="All files approved! Send this version to Project Manager (PM) for managerial clearance"
                                                >
                                                    {sendingPM ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                    Send to PM
                                                </button>
                                            )}

                                            {activeFolder?.pm_status === 'pending_pm_review' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        backgroundColor: '#eef2ff',
                                                        color: '#4338ca',
                                                        border: '1px solid #c7d2fe',
                                                        padding: '4px 10px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.76rem',
                                                        fontWeight: 800,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}>
                                                        <Clock size={13} /> Under PM Review
                                                    </span>

                                                    {isPMOrAdmin && (
                                                        <>
                                                            <button
                                                                onClick={() => activeFolderId && handlePMApprove(activeFolderId)}
                                                                style={{
                                                                    padding: '5px 12px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    backgroundColor: '#16a34a',
                                                                    color: '#ffffff',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.76rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                                                                }}
                                                                title="Accept & Clear this version for Final QC Approval"
                                                            >
                                                                <CheckCircle2 size={13} /> PM Accept / Clearance
                                                            </button>
                                                            <button
                                                                onClick={() => activeFolderId && handlePMReject(activeFolderId)}
                                                                style={{
                                                                    padding: '5px 12px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    backgroundColor: '#dc2626',
                                                                    color: '#ffffff',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.76rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                                                                }}
                                                                title="Return to QC with notes"
                                                            >
                                                                <XCircle size={13} /> PM Reject
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {activeFolder?.pm_status === 'pm_approved' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {!activeFolder?.final_qc_approved ? (
                                                        <>
                                                            <span style={{
                                                                backgroundColor: '#eff6ff',
                                                                color: '#1d4ed8',
                                                                border: '1px solid #bfdbfe',
                                                                padding: '4px 10px',
                                                                borderRadius: '8px',
                                                                fontSize: '0.76rem',
                                                                fontWeight: 800,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '5px'
                                                            }}>
                                                                <ShieldCheck size={13} color="#2563eb" /> PM Clearance Granted
                                                            </span>

                                                            {canApproveQC ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <button
                                                                        onClick={() => activeFolderId && handleQCFinalApprove(activeFolderId)}
                                                                        style={{
                                                                            padding: '6px 14px',
                                                                            borderRadius: '8px',
                                                                            border: 'none',
                                                                            backgroundColor: '#16a34a',
                                                                            color: '#ffffff',
                                                                            fontWeight: 800,
                                                                            fontSize: '0.78rem',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '5px',
                                                                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                                                                        }}
                                                                        title="Issue Final Approval for this version"
                                                                    >
                                                                        <CheckCircle2 size={14} /> Approve Version
                                                                    </button>
                                                                    <button
                                                                        onClick={() => activeFolderId && handleQCFinalReject(activeFolderId)}
                                                                        style={{
                                                                            padding: '6px 12px',
                                                                            borderRadius: '8px',
                                                                            border: 'none',
                                                                            backgroundColor: '#dc2626',
                                                                            color: '#ffffff',
                                                                            fontWeight: 800,
                                                                            fontSize: '0.78rem',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '5px',
                                                                            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                                                                        }}
                                                                        title="Reject version and request corrections"
                                                                    >
                                                                        <AlertTriangle size={14} /> Reject / Request Changes
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>(Awaiting Final QC Decision)</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span style={{
                                                            backgroundColor: '#ecfdf5',
                                                            color: '#065f46',
                                                            border: '1.5px solid #a7f3d0',
                                                            padding: '5px 14px',
                                                            borderRadius: '8px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 800,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}>
                                                            <CheckCircle2 size={14} color="#059669" /> Total Final Approved &amp; Budget Sealed ✓
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* GRID FILTER OPTION */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>
                                        <span>Filter:</span>
                                        <select
                                            value={gridFilter}
                                            onChange={(e) => setGridFilter(e.target.value as any)}
                                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, outline: 'none', backgroundColor: '#ffffff', color: '#0c1527', cursor: 'pointer' }}
                                        >
                                            <option value="all">All Statuses</option>
                                            <option value="pending_review">Pending Review</option>
                                            <option value="under_review">Under Review</option>
                                            <option value="changes_requested">Rejected</option>
                                            <option value="approved">Approved</option>
                                            <option value="resolved">Resolved (All Comments Cleared)</option>
                                            <option value="reopened">🔄 Reopened Issues</option>
                                        </select>
                                    </div>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                        multiple
                                        accept=".pdf,.png,.jpg,.jpeg,.dwg,*"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        style={{ padding: '9px 16px', borderRadius: '8px', backgroundColor: '#ea580c', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 800, fontSize: '0.82rem', boxShadow: '0 2px 8px rgba(234,88,12,0.2)' }}
                                        title="Upload project drawings and PDF documents into this version folder"
                                    >
                                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                        {uploading ? 'Uploading...' : '+ Upload Drawings / Files'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                                {/* PM Rejection Alert Banner inside Folder */}
                                {activeFolder?.pm_status === 'pm_rejected' && (
                                    <div style={{
                                        marginBottom: '20px',
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        backgroundColor: '#fff1f2',
                                        border: '1.5px solid #fda4af',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '12px',
                                        boxShadow: '0 2px 6px rgba(225, 29, 72, 0.08)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48', flexShrink: 0 }}>
                                                <AlertTriangle size={20} />
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <strong style={{ fontSize: '0.90rem', color: '#9f1239' }}>Rejected by Project Manager (PM)</strong>
                                                    <span style={{ backgroundColor: '#e11d48', color: '#ffffff', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase' }}>Trigger: Rejected by PM</span>
                                                </div>
                                                {activeFolder.pm_notes ? (
                                                    <div style={{ fontSize: '0.82rem', color: '#881337', marginTop: '4px', fontStyle: 'italic', backgroundColor: '#ffffff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecdd3' }}>
                                                        "{activeFolder.pm_notes}"
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.78rem', color: '#881337', marginTop: '3px' }}>
                                                        Project Manager requested corrections on this version.
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '0.74rem', color: '#be123c', marginTop: '4px' }}>
                                                    Reviewed by <strong>{activeFolder.pm_reviewer_name || 'Project Manager'}</strong> • Reopened comments require rectification by designer before resubmission.
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setRejectModalFolderId(activeFolderId);
                                                setShowRejectModal(true);
                                            }}
                                            style={{
                                                padding: '7px 14px',
                                                borderRadius: '8px',
                                                backgroundColor: '#e11d48',
                                                color: '#ffffff',
                                                border: 'none',
                                                fontWeight: 800,
                                                fontSize: '0.78rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                boxShadow: '0 2px 6px rgba(225, 29, 72, 0.25)'
                                            }}
                                        >
                                            <AlertTriangle size={14} /> View PM Notes &amp; Reopened Comments
                                        </button>
                                    </div>
                                )}

                                {filesLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" /></div>
                                ) : files.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.95rem', marginTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '24px', backgroundColor: '#f3f4f6', borderRadius: '50%', display: 'inline-block' }}>
                                            <Upload size={32} color="#9ca3af" />
                                        </div>
                                        <p>This QC folder is empty.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                                        {files.filter(f => {
                                            if (gridFilter === 'all') return true;
                                            if (gridFilter === 'resolved') {
                                                const fileComments = allCommentsMap[f.file_id] || [];
                                                return fileComments.length > 0 && fileComments.every(c => c.status === 'resolved' || c.status === 'approved');
                                            }
                                            if (gridFilter === 'reopened') {
                                                const fileComments = allCommentsMap[f.file_id] || [];
                                                return fileComments.some(c => c.status === 'reopen');
                                            }
                                            return f.status === gridFilter;
                                        }).map(file => (
                                            <div
                                                key={file.file_id}
                                                style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', position: 'relative', cursor: 'pointer', transition: 'box-shadow 0.2s', backgroundColor: 'white' }}
                                                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                                                onClick={() => handleOpenFileWithLock(file)}
                                            >
                                                {/* Top Icon Box */}
                                                <div style={{ height: '140px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb', position: 'relative' }}>
                                                    <FileText size={48} color="#ef4444" />

                                                    {/* VERSION HISTORY DROPDOWN ATTACHED TO VERSION TAG */}
                                                    <div style={{ position: 'absolute', top: '10px', right: '10px' }} onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (openVersionMenuId === file.file_id) {
                                                                    setOpenVersionMenuId(null);
                                                                } else {
                                                                    setOpenVersionMenuId(file.file_id);
                                                                    fetchVersions(file.file_id);
                                                                }
                                                            }}
                                                            style={{ backgroundColor: '#ffffff', color: '#0c1527', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}
                                                            title="View prior revisions"
                                                        >
                                                            Rev-0{file.revision_number || 1} ▾
                                                        </button>

                                                        {openVersionMenuId === file.file_id && (
                                                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', zIndex: 100, minWidth: '170px', padding: '6px' }}>
                                                                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', padding: '4px 8px', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Revision History</div>
                                                                {(fileVersionsMap[file.file_id] || [file]).map(v => (
                                                                    <div
                                                                        key={v.file_id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenVersionMenuId(null);
                                                                            handleOpenFileWithLock(v);
                                                                        }}
                                                                        style={{ padding: '7px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: v.file_id === file.file_id ? 800 : 600, cursor: 'pointer', backgroundColor: v.file_id === file.file_id ? '#fff7ed' : 'transparent', color: v.file_id === file.file_id ? '#ea580c' : '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}
                                                                    >
                                                                        <span>Rev-0{v.revision_number || 1} {v.file_id === file.file_id ? '(Current)' : ''}</span>
                                                                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{v.status}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card Details */}
                                                <div style={{ padding: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 4px 0' }}>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={file.file_name}>
                                                            {file.file_name}
                                                        </p>
                                                        {canManageQCVersionsAndFiles && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleRenameFile(e, file.file_id, file.file_name)}
                                                                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}
                                                                    title="Rename file"
                                                                >
                                                                    <Edit3 size={13} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleDeleteFile(e, file.file_id, file.file_name)}
                                                                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}
                                                                    title="Delete file"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#6b7280' }}>
                                                        By {file.uploader_name || 'Admin'}
                                                    </p>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                        {/* DUAL BADGE: Rule 3 & 5 File-Level Badge */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                            {getStatusBadge(file.status)}
                                                            {(() => {
                                                                const isFileRejected = (file.status as any) === 'changes_requested' || (file.status as any) === 'rejected' || (file.status as any) === 'pm_rejected';
                                                                const fComments = allCommentsMap[file.file_id] || (previewFile?.file_id === file.file_id ? comments : []);
                                                                return getResolutionStatusBadge(fComments, isFileRejected);
                                                            })()}
                                                        </div>
                                                        {file.reviewer_name && file.status === 'under_review' && (
                                                            <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700 }}>Review: {file.reviewer_name}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                            Select a folder from the sidebar
                        </div>
                    )}
                </div>
            </div>

            {/* CREATE FOLDER MODAL */}
            {showFolderModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#111827' }}>Create New QC Folder</h3>
                        <form onSubmit={handleCreateFolder}>
                            <input
                                type="text"
                                autoFocus
                                required
                                placeholder="e.g. Quotation Reviews, Site Drawings"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', marginBottom: '20px' }}
                            />
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowFolderModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 500 }}>Cancel</button>
                                <button type="submit" disabled={submittingFolder} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {submittingFolder && <Loader2 size={14} className="animate-spin" />} Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* FULL-SCREEN FILE & PDF COMMENTS MODAL */}
            {previewFile && (() => {
                const fileComments = comments.filter(c => !c.file_id || Number(c.file_id) === Number(previewFile.file_id));
                // RULE 9: SEVERITY GATE: High severity AND status is Open or Reopen -> Blocks Approval
                const hasUnresolvedHighSeverity = fileComments.some(c =>
                    ((c.severity || '').toLowerCase() === 'high' || (c.severity || '').toLowerCase() === 'critical') &&
                    (c.status === 'open' || c.status === 'reopen')
                );
                const isApprovedImmutable = previewFile.status === 'approved';
                const isRejected = previewFile.status === 'changes_requested';
                const isQCInspector = canApproveQC;

                const openCount = fileComments.filter(c => c.status === 'open' || c.status === 'reopen').length;
                const resolvedCount = fileComments.filter(c => c.status === 'resolved').length;
                const reopenCount = fileComments.filter(c => c.status === 'reopen').length;
                const approvedCount = fileComments.filter(c => c.status === 'approved').length;

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', zIndex: 99999 }}>

                        {/* Dark Modal Header */}
                        <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0c1527', borderBottom: '1px solid #1e293b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ShieldCheck size={20} color="#ea580c" />
                                <h3 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 700 }}>{previewFile.file_name}</h3>
                                <span style={{ backgroundColor: '#1e293b', color: '#fca412', border: '1px solid #ea580c', padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>
                                    Rev-0{previewFile.revision_number || 1}
                                </span>
                                {getStatusBadge(previewFile.status)}
                                {(() => {
                                    const isFileRejected = (previewFile.status as any) === 'changes_requested' || (previewFile.status as any) === 'rejected' || (previewFile.status as any) === 'pm_rejected';
                                    return getResolutionStatusBadge(comments, isFileRejected);
                                })()}
                                {isApprovedImmutable && (
                                    <span style={{ backgroundColor: '#064e3b', color: '#34d399', border: '1px solid #059669', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                                        🔒 Approved Revision (Immutable)
                                    </span>
                                )}
                                {isRejected && (
                                    <span style={{ backgroundColor: '#450a0a', color: '#f87171', border: '1px solid #ef4444', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                                        ❌ Rejected Revision
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Main Modal Content Split View: LEFT = PDF Document Viewer (with P-1..P-8), RIGHT = PDF Comments */}
                        <div style={{ flex: 1, display: 'flex', padding: '20px', gap: '20px', overflow: 'hidden' }}>

                            {/* LEFT SIDE: Document Asset Pane with Left-Side Vertical P-1..P-8 Page Jump Sidebar */}
                            <div style={{ flex: 1, height: '100%', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>

                                {/* Inner Layout: Left Vertical P-1..P-8 Navigation Sidebar + Main PDF Canvas */}
                                <div style={{ flex: 1, display: 'flex', gap: '12px', height: '100%', overflow: 'hidden' }}>

                                    {/* LEFT-SIDE VERTICAL PAGE NAVIGATOR SIDEBAR (P-1, P-2, P-3, P-4, P-5, P-6, P-7, P-8) */}
                                    <div style={{
                                        width: '54px',
                                        backgroundColor: '#0f172a',
                                        borderRadius: '8px',
                                        padding: '10px 4px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                        overflowY: 'auto',
                                        boxShadow: 'inset 0 0 6px rgba(0,0,0,0.3)'
                                    }}>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px', textAlign: 'center' }}>
                                            PAGE
                                        </div>
                                        {Array.from({ length: Math.max(1, pdfTotalPages || 1) }, (_, i) => i + 1).map(pNum => (
                                            <button
                                                key={`left-vert-p-${pNum}`}
                                                type="button"
                                                onClick={() => {
                                                    setActivePage(pNum);
                                                    setCommentPageNum(pNum);
                                                    const targetEl = document.getElementById(`pdf-page-${pNum}`) || document.getElementById(`quote-page-${pNum}`);
                                                    if (targetEl) {
                                                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                }}
                                                style={{
                                                    width: '42px',
                                                    padding: '6px 0',
                                                    borderRadius: '6px',
                                                    border: activePage === pNum ? '2px solid #3b82f6' : '1px solid #334155',
                                                    backgroundColor: activePage === pNum ? '#2563eb' : '#1e293b',
                                                    color: '#ffffff',
                                                    fontWeight: 800,
                                                    fontSize: '0.76rem',
                                                    cursor: 'pointer',
                                                    boxShadow: activePage === pNum ? '0 2px 6px rgba(37,99,235,0.4)' : 'none',
                                                    transition: 'all 0.15s'
                                                }}
                                                title={`Click to jump to Page ${pNum}`}
                                            >
                                                P-{pNum}
                                            </button>
                                        ))}
                                    </div>

                                    {/* CENTER MAIN PDF VIEWER CANVAS PANE */}
                                    <div
                                        ref={documentViewerRef}
                                        onMouseDown={handleViewerMouseDown}
                                        onMouseUp={handleTextSelection}
                                        style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
                                    >
                                        {/* Top Banner Header */}
                                        <div style={{
                                            padding: '8px 14px',
                                            backgroundColor: '#0c1527',
                                            color: '#ffffff',
                                            borderRadius: '6px 6px 0 0',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.82rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ backgroundColor: '#ea580c', color: '#ffffff', padding: '3px 10px', borderRadius: '4px', fontWeight: 800 }}>
                                                    📜 PDF Viewer
                                                </span>
                                                <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.78rem' }}>
                                                    Active View: <strong style={{ color: '#fca412' }}>Page {activePage} of {pdfTotalPages}</strong>
                                                </span>
                                            </div>

                                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>
                                                Select text or drag area to annotate issue
                                            </div>
                                        </div>

                                        {/* Main PDF View Pane */}
                                        {previewFile.quote_id || previewFile.file_type === 'quote_pdf' ? (
                                            <div style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: '0 0 6px 6px', overflowY: 'auto', border: '1px solid #cbd5e1', padding: '16px', position: 'relative' }}>
                                                <QuotePdfDocument quoteId={previewFile.quote_id} projectId={projectId} activePage={activePage} onPageCount={(cnt) => setPdfTotalPages(cnt)} />
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, backgroundColor: '#334155', borderRadius: '0 0 6px 6px', overflowY: 'auto', border: '1px solid #cbd5e1', padding: '16px', position: 'relative' }}>
                                                <PdfDocumentViewer
                                                    url={getFileUrl(previewFile)}
                                                    fileName={previewFile.file_name}
                                                    fileType={previewFile.file_type}
                                                    activePage={activePage}
                                                    onPageCount={(cnt) => setPdfTotalPages(cnt)}
                                                />
                                            </div>
                                        )}

                                        {/* Underline Annotation Layer (Portaled into individual pages so highlights scroll with the PDF) */}
                                        {fileComments.filter(c => (showAllPages || true || c.page_number === activePage) && c.box_x != null && c.box_y != null && String(c.box_w) !== '0').map(c => {
                                            const pNum = c.page_number || 1;
                                            const pageTargetEl = document.getElementById(`pdf-page-${pNum}`);
                                            const bx = parseFloat(String(c.box_x));
                                            const by = parseFloat(String(c.box_y));
                                            const bw = parseFloat(String(c.box_w));
                                            const bh = parseFloat(String(c.box_h));
                                            const isResolvedOrApproved = c.status === 'resolved' || c.status === 'approved';
                                            const isFlashing = flashingCommentId === c.comment_id;

                                            const underlineColor = isResolvedOrApproved ? 'rgba(156, 163, 175, 0.6)' : '#dc2626';
                                            const borderStyle = `2.5px solid ${underlineColor}`;
                                            const opacity = isResolvedOrApproved ? 0.45 : 1;

                                            const annotElement = (
                                                <div
                                                    key={`hl-${c.comment_id}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${bx}%`,
                                                        top: `${by}%`,
                                                        width: `${bw}%`,
                                                        height: `${bh}%`,
                                                        backgroundColor: isFlashing ? 'rgba(234, 88, 12, 0.35)' : 'rgba(239, 68, 68, 0.12)',
                                                        borderBottom: borderStyle,
                                                        opacity: opacity,
                                                        transition: 'all 0.3s ease-in-out',
                                                        boxShadow: isFlashing ? '0 0 0 3px #ea580c, 0 4px 12px rgba(234, 88, 12, 0.8)' : 'none',
                                                        transform: isFlashing ? 'scale(1.03)' : 'scale(1)',
                                                        zIndex: isFlashing ? 35 : 20,
                                                        pointerEvents: 'none',
                                                        borderRadius: '2px'
                                                    }}
                                                    title={`Issue #${c.comment_id}: ${c.comment_text}`}
                                                />
                                            );

                                            if (pageTargetEl) {
                                                return createPortal(annotElement, pageTargetEl);
                                            }

                                            // Fallback if page element not yet available or for iframe view
                                            return (
                                                <div key={`hl-fallback-${c.comment_id}`} style={{ position: 'absolute', top: '38px', left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 20 }}>
                                                    {annotElement}
                                                </div>
                                            );
                                        })}

                                        {/* Live Selection Highlight Box (Portaled into the active page) */}
                                        {selectionBox && (() => {
                                            const selPageNum = selectionBox.page || activePage;
                                            const selPageEl = document.getElementById(`pdf-page-${selPageNum}`);
                                            const selBoxElement = (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${selectionBox.x}%`,
                                                        top: `${selectionBox.y}%`,
                                                        width: `${selectionBox.w}%`,
                                                        height: `${selectionBox.h}%`,
                                                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                                        borderBottom: '2.5px dashed #2563eb',
                                                        pointerEvents: 'none',
                                                        zIndex: 25,
                                                        borderRadius: '2px'
                                                    }}
                                                />
                                            );

                                            if (selPageEl) {
                                                return createPortal(selBoxElement, selPageEl);
                                            }

                                            return (
                                                <div style={{ position: 'absolute', top: '38px', left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 25 }}>
                                                    {selBoxElement}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: PDF Comments & Issue Panel (Width 380px) */}
                            <div style={{ width: '380px', backgroundColor: 'white', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>

                                {/* Panel Header with Filter & Comment Numbers */}
                                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0c1527' }}>PDF Comments</h4>
                                        <span style={{ backgroundColor: '#ea580c', color: '#ffffff', borderRadius: '10px', padding: '1px 8px', fontSize: '0.74rem', fontWeight: 800 }}>
                                            {fileComments.length}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                                        <span style={{ color: '#64748b', fontWeight: 700 }}>Filter:</span>
                                        <select
                                            value={pageFilter}
                                            onChange={(e) => setPageFilter(e.target.value)}
                                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.76rem', fontWeight: 700, outline: 'none', backgroundColor: '#ffffff' }}
                                        >
                                            <option value="open">🟠 Open Comments ({openCount})</option>
                                            <option value="resolved">✅ Resolved ({resolvedCount})</option>
                                            <option value="reopen">🔄 Reopened ({reopenCount})</option>
                                            <option value="all">📜 All Comments ({fileComments.length})</option>
                                            {isQCInspector && (
                                                <option value="approved">🟢 Approved ({approvedCount})</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                    {/* RULE 3 & 9: Manual QC Control (Approve/Reject) & SEVERITY GATE */}
                                    {isQCInspector && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleUpdateQCStatus('approved')}
                                                    disabled={updatingStatus || isApprovedImmutable || hasUnresolvedHighSeverity}
                                                    style={{
                                                        flex: 1, padding: '8px 10px', borderRadius: '8px', border: 'none',
                                                        backgroundColor: (isApprovedImmutable || hasUnresolvedHighSeverity) ? '#94a3b8' : '#16a34a',
                                                        color: '#ffffff', fontWeight: 800, fontSize: '0.78rem',
                                                        cursor: (isApprovedImmutable || hasUnresolvedHighSeverity) ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                        opacity: (isApprovedImmutable || hasUnresolvedHighSeverity) ? 0.65 : 1
                                                    }}
                                                    title={
                                                        isApprovedImmutable ? "Approved revision is immutable" :
                                                            hasUnresolvedHighSeverity ? "Cannot approve while High severity Open/Reopen issues remain" : "Approve File"
                                                    }
                                                >
                                                    <CheckCircle2 size={14} /> Approve File
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateQCStatus('changes_requested')}
                                                    disabled={updatingStatus || isApprovedImmutable || isRejected}
                                                    style={{
                                                        flex: 1, padding: '8px 10px', borderRadius: '8px', border: 'none',
                                                        backgroundColor: (isApprovedImmutable || isRejected) ? '#94a3b8' : '#dc2626',
                                                        color: '#ffffff', fontWeight: 800, fontSize: '0.78rem',
                                                        cursor: (isApprovedImmutable || isRejected) ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                        opacity: (isApprovedImmutable || isRejected) ? 0.65 : 1
                                                    }}
                                                    title={
                                                        isApprovedImmutable ? "Approved revision is immutable" :
                                                            isRejected ? "Revision is already marked as Rejected" : "Reject & Request Changes"
                                                    }
                                                >
                                                    <XCircle size={14} /> {isRejected ? 'Already Rejected' : 'Reject Revision'}
                                                </button>
                                            </div>

                                            {/* REJECTED NOTICE */}
                                            {isRejected && (
                                                <div style={{ fontSize: '0.74rem', color: '#b91c1c', backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', padding: '8px 10px', borderRadius: '8px', fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <AlertTriangle size={14} color="#dc2626" />
                                                    This revision is Rejected. Waiting for Designer to commit corrections in next revision.
                                                </div>
                                            )}

                                            {/* SEVERITY GATE ALERT */}
                                            {hasUnresolvedHighSeverity && !isApprovedImmutable && !isRejected && (
                                                <div style={{ fontSize: '0.72rem', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', padding: '6px 8px', borderRadius: '6px', fontWeight: 700, textAlign: 'center' }}>
                                                    ⚠️ Approval disabled: Resolve or Approve all High severity comments first.
                                                </div>
                                            )}
                                            {isApprovedImmutable && (
                                                <div style={{ fontSize: '0.72rem', color: '#047857', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 8px', borderRadius: '6px', fontWeight: 700, textAlign: 'center' }}>
                                                    🔒 Approved revision is locked &amp; immutable.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Add Comment Form with SEVERITY Selector & INSTANT PAGE JUMP INPUT */}
                                    {isQCInspector && !isApprovedImmutable && (
                                        <form onSubmit={handleAddComment} style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>

                                            {/* Page No & Jump Button */}
                                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Page No (Type &amp; Press Enter or Jump):</label>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max={pdfTotalPages}
                                                            placeholder={`Page (1-${pdfTotalPages})`}
                                                            value={commentPageNum === 0 || commentPageNum === '' ? '' : commentPageNum}
                                                            onChange={(e) => {
                                                                const raw = e.target.value;
                                                                if (raw === '') {
                                                                    setCommentPageNum('');
                                                                    return;
                                                                }
                                                                const val = parseInt(raw, 10);
                                                                if (!isNaN(val) && val >= 1) {
                                                                    setCommentPageNum(val);
                                                                    setActivePage(val);
                                                                    const targetEl = document.getElementById(`pdf-page-${val}`) || document.getElementById(`quote-page-${val}`);
                                                                    if (targetEl) {
                                                                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                    }
                                                                } else {
                                                                    setCommentPageNum('');
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    const val = typeof commentPageNum === 'number' ? commentPageNum : parseInt(String(commentPageNum), 10);
                                                                    if (!isNaN(val) && val >= 1) {
                                                                        setActivePage(val);
                                                                        setCommentPageNum(val);
                                                                        const targetEl = document.getElementById(`pdf-page-${val}`) || document.getElementById(`quote-page-${val}`);
                                                                        if (targetEl) {
                                                                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                        }
                                                                    }
                                                                }
                                                            }}
                                                            style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1.5px solid #3b82f6', fontSize: '0.84rem', outline: 'none', fontWeight: 800, backgroundColor: '#ffffff' }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const val = typeof commentPageNum === 'number' ? commentPageNum : parseInt(String(commentPageNum), 10);
                                                                if (!isNaN(val) && val >= 1) {
                                                                    setActivePage(val);
                                                                    setCommentPageNum(val);
                                                                    const targetEl = document.getElementById(`pdf-page-${val}`) || document.getElementById(`quote-page-${val}`);
                                                                    if (targetEl) {
                                                                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                    }
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                border: 'none',
                                                                backgroundColor: '#2563eb',
                                                                color: '#ffffff',
                                                                fontWeight: 800,
                                                                fontSize: '0.76rem',
                                                                cursor: 'pointer',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            ⚡ Jump Page
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Selected Text / Spelling Mistake */}
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Selected Text / spelling mistake (optional):</label>
                                                <input
                                                    type="text"
                                                    value={selectedTargetText}
                                                    onChange={(e) => setSelectedTargetText(e.target.value)}
                                                    placeholder="Copy & paste or highlight original text..."
                                                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem', outline: 'none' }}
                                                />
                                            </div>

                                            {/* Correction Remark / Comment */}
                                            <div style={{ marginBottom: '12px' }}>
                                                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Correction Remark / Comment:</label>
                                                <textarea
                                                    rows={3}
                                                    value={commentRemark}
                                                    onChange={(e) => setCommentRemark(e.target.value)}
                                                    placeholder="Add page specific correction note..."
                                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', resize: 'vertical' }}
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={addingComment}
                                                style={{ width: '100%', padding: '9px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                                            >
                                                {addingComment ? 'Adding...' : 'Add Comment'}
                                            </button>
                                        </form>
                                    )}

                                    {/* Comments List Grouped Page-Wise (Page Accordion Sections) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {commentsLoading ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader2 className="animate-spin" /></div>
                                        ) : filteredComments.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '20px', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                                                No issues logged for {pageFilter === 'current' ? `Page ${activePage}` : 'this file'}.
                                            </div>
                                        ) : (
                                            (() => {
                                                // Group filtered comments by page_number
                                                const pageGroups: Record<number, QCComment[]> = {};
                                                filteredComments.forEach(c => {
                                                    const pg = c.page_number || 1;
                                                    if (!pageGroups[pg]) pageGroups[pg] = [];
                                                    pageGroups[pg].push(c);
                                                });

                                                const pageNums = Object.keys(pageGroups).map(Number).sort((a, b) => a - b);

                                                return pageNums.map(pgNum => {
                                                    const pageCmts = pageGroups[pgNum];
                                                    const isExpanded = expandedPages[pgNum] !== false; // default expanded
                                                    const openOnPage = pageCmts.filter(c => c.status === 'open' || c.status === 'reopen').length;
                                                    const resolvedOnPage = pageCmts.filter(c => c.status === 'resolved' || c.status === 'approved').length;
                                                    const isCurrentActivePage = activePage === pgNum;

                                                    return (
                                                        <div
                                                            key={`page-group-${pgNum}`}
                                                            style={{
                                                                border: isCurrentActivePage ? '2px solid #3b82f6' : '1.5px solid #cbd5e1',
                                                                borderRadius: '10px',
                                                                overflow: 'hidden',
                                                                backgroundColor: '#ffffff',
                                                                boxShadow: isCurrentActivePage ? '0 2px 8px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {/* Page Accordion Header */}
                                                            <div
                                                                onClick={() => {
                                                                    setExpandedPages(prev => ({ ...prev, [pgNum]: prev[pgNum] === undefined ? false : !prev[pgNum] }));
                                                                    setActivePage(pgNum);
                                                                    setCommentPageNum(pgNum);
                                                                }}
                                                                style={{
                                                                    padding: '10px 14px',
                                                                    backgroundColor: isCurrentActivePage ? '#eff6ff' : '#f8fafc',
                                                                    borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none',
                                                                    transition: 'all 0.15s'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: isCurrentActivePage ? '#1d4ed8' : '#1e293b', backgroundColor: isCurrentActivePage ? '#dbeafe' : '#e2e8f0', padding: '3px 9px', borderRadius: '6px', border: `1px solid ${isCurrentActivePage ? '#93c5fd' : '#cbd5e1'}` }}>
                                                                        📄 Page {pgNum}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
                                                                        ({pageCmts.length} {pageCmts.length === 1 ? 'Issue' : 'Issues'})
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    {openOnPage > 0 && (
                                                                        <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', padding: '2px 7px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 800 }}>
                                                                            🟠 {openOnPage} Open
                                                                        </span>
                                                                    )}
                                                                    {resolvedOnPage > 0 && (
                                                                        <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 7px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 800 }}>
                                                                            ✅ {resolvedOnPage} Resolved
                                                                        </span>
                                                                    )}
                                                                    <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 800, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginLeft: '4px' }}>
                                                                        ▼
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Page Comments Cards List */}
                                                            {isExpanded && (
                                                                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc' }}>
                                                                    {pageCmts.map((c) => (
                                                                        <div
                                                                            key={c.comment_id}
                                                                            onClick={() => {
                                                                                setActivePage(c.page_number);
                                                                                setCommentPageNum(c.page_number);
                                                                                setFlashingCommentId(c.comment_id);
                                                                                setTimeout(() => setFlashingCommentId(null), 1800);
                                                                            }}
                                                                            style={{
                                                                                backgroundColor: flashingCommentId === c.comment_id ? '#fef3c7' : '#ffffff',
                                                                                border: flashingCommentId === c.comment_id ? '2px solid #ea580c' : '1px solid #e2e8f0',
                                                                                borderRadius: '8px',
                                                                                padding: '12px',
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                gap: '8px',
                                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                                                cursor: 'pointer',
                                                                                transition: 'all 0.2s',
                                                                                boxSizing: 'border-box',
                                                                                width: '100%',
                                                                                overflow: 'hidden'
                                                                            }}
                                                                        >
                                                                            {/* Correction Target (Original Text) */}
                                                                            {c.target_text && (
                                                                                <div style={{ backgroundColor: '#fff7ed', borderLeft: '3px solid #ea580c', padding: '7px 10px', borderRadius: '4px', fontSize: '0.78rem', color: '#9a3412', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                                                                    <span style={{ fontWeight: 800, fontStyle: 'normal' }}>Correction target: </span>"{c.target_text}"
                                                                                </div>
                                                                            )}

                                                                            {/* Comment / Remark Text */}
                                                                            {c.comment_text && (
                                                                                <div style={{ fontSize: '0.84rem', color: '#1e293b', lineHeight: 1.45, fontWeight: 600, wordBreak: 'break-word' }}>
                                                                                    {c.comment_text}
                                                                                </div>
                                                                            )}

                                                                            {/* Bottom Row: Status Actions, Reply & Show History */}
                                                                            <div style={{
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center',
                                                                                marginTop: '4px',
                                                                                paddingTop: '8px',
                                                                                borderTop: '1px dashed #e2e8f0',
                                                                                flexWrap: 'wrap',
                                                                                gap: '6px',
                                                                                width: '100%',
                                                                                boxSizing: 'border-box'
                                                                            }}>
                                                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}>
                                                                                    {(() => {
                                                                                        const hasReplies = Array.isArray(c.replies) && c.replies.length > 0;
                                                                                        return (
                                                                                            <select
                                                                                                value={c.status || 'open'}
                                                                                                onClick={(e) => e.stopPropagation()}
                                                                                                onChange={(e) => {
                                                                                                    const nextStatus = e.target.value as any;
                                                                                                    if (nextStatus === 'resolved' && !hasReplies) {
                                                                                                        alert('A reply is required before marking this issue as resolved. Please post a reply first.');
                                                                                                        setReplyingCommentId(c.comment_id);
                                                                                                        return;
                                                                                                    }
                                                                                                    handleUpdateCommentStatus(c.comment_id, nextStatus);
                                                                                                }}
                                                                                                style={{
                                                                                                    padding: '4px 8px',
                                                                                                    borderRadius: '6px',
                                                                                                    border: `1.5px solid ${c.status === 'resolved' ? '#86efac' :
                                                                                                        c.status === 'reopen' ? '#fcd34d' :
                                                                                                            c.status === 'approved' ? '#6ee7b7' : '#fdba74'
                                                                                                        }`,
                                                                                                    fontSize: '0.74rem',
                                                                                                    fontWeight: 800,
                                                                                                    backgroundColor:
                                                                                                        c.status === 'resolved' ? '#f0fdf4' :
                                                                                                            c.status === 'reopen' ? '#fefce8' :
                                                                                                                c.status === 'approved' ? '#ecfdf5' : '#fff7ed',
                                                                                                    color:
                                                                                                        c.status === 'resolved' ? '#15803d' :
                                                                                                            c.status === 'reopen' ? '#b45309' :
                                                                                                                c.status === 'approved' ? '#047857' : '#c2410c',
                                                                                                    cursor: 'pointer',
                                                                                                    maxWidth: '135px',
                                                                                                    outline: 'none',
                                                                                                    boxSizing: 'border-box'
                                                                                                }}
                                                                                            >
                                                                                                <option value="open">🟠 Open</option>
                                                                                                <option value="resolved" disabled={!hasReplies}>
                                                                                                    {hasReplies ? '✅ Resolved' : '🔒 Resolved (Reply req.)'}
                                                                                                </option>
                                                                                                <option value="reopen">🔄 Reopen</option>
                                                                                                {(isQCInspector || c.status === 'approved') && (
                                                                                                    <option value="approved">🟢 Approved</option>
                                                                                                )}
                                                                                            </select>
                                                                                        );
                                                                                    })()}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (replyingCommentId === c.comment_id) {
                                                                                                setReplyingCommentId(null);
                                                                                            } else {
                                                                                                setReplyingCommentId(c.comment_id);
                                                                                                setReplyText('');
                                                                                            }
                                                                                        }}
                                                                                        style={{
                                                                                            backgroundColor: replyingCommentId === c.comment_id ? '#eff6ff' : '#f1f5f9',
                                                                                            color: '#2563eb',
                                                                                            border: '1px solid #cbd5e1',
                                                                                            borderRadius: '6px',
                                                                                            padding: '4px 8px',
                                                                                            fontSize: '0.74rem',
                                                                                            fontWeight: 700,
                                                                                            cursor: 'pointer',
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                            whiteSpace: 'nowrap',
                                                                                            flexShrink: 0
                                                                                        }}
                                                                                    >
                                                                                        💬 Reply
                                                                                    </button>
                                                                                </div>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        toggleHistory(c.comment_id);
                                                                                    }}
                                                                                    style={{
                                                                                        background: 'none',
                                                                                        border: 'none',
                                                                                        color: '#64748b',
                                                                                        fontSize: '0.72rem',
                                                                                        fontWeight: 700,
                                                                                        cursor: 'pointer',
                                                                                        textDecoration: 'underline',
                                                                                        whiteSpace: 'nowrap',
                                                                                        flexShrink: 0
                                                                                    }}
                                                                                >
                                                                                    {expandedHistory[c.comment_id] ? 'Hide History' : `Show History (${(c.replies?.length || 0) + 1})`}
                                                                                </button>
                                                                            </div>

                                                                            {/* Inline Reply Form */}
                                                                            {replyingCommentId === c.comment_id && (
                                                                                <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px' }}>
                                                                                    <textarea
                                                                                        rows={2}
                                                                                        value={replyText}
                                                                                        onChange={(e) => setReplyText(e.target.value)}
                                                                                        placeholder="Type designer reply or update note..."
                                                                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem', outline: 'none', marginBottom: '6px' }}
                                                                                    />
                                                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setReplyingCommentId(null)}
                                                                                            style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                                                                                        >
                                                                                            Cancel
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleAddReply(c.comment_id)}
                                                                                            disabled={postingReply || !replyText.trim()}
                                                                                            style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                                                                                        >
                                                                                            {postingReply ? 'Posting...' : 'Post Reply'}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Comment History Thread */}
                                                                            {(expandedHistory[c.comment_id] || (c.replies && c.replies.length > 0 && replyingCommentId === c.comment_id)) && (
                                                                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                                    <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>History &amp; Discussion Thread:</div>
                                                                                    <div style={{ backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '6px', fontSize: '0.76rem', color: '#475569' }}>
                                                                                        <span style={{ fontWeight: 800, color: '#0f172a' }}>{c.user_name} (Created Issue): </span>
                                                                                        {c.comment_text}
                                                                                    </div>
                                                                                    {(c.replies || []).map((rep) => (
                                                                                        <div key={rep.reply_id} style={{ backgroundColor: '#eff6ff', padding: '8px 10px', borderRadius: '6px', fontSize: '0.76rem', color: '#1e3a8a', borderLeft: '3px solid #3b82f6' }}>
                                                                                            <div style={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                                                                <span>💬 {rep.user_name} ({rep.user_role})</span>
                                                                                                <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>{new Date(rep.created_at).toLocaleString('en-IN')}</span>
                                                                                            </div>
                                                                                            <div>{rep.reply_text}</div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            })()
                                        )}
                                    </div>
                                </div>

                                {/* Modal Footer with Download File */}
                                <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'center' }}>
                                    <a
                                        href={getFileUrl(previewFile)}
                                        download={previewFile.file_name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ padding: '8px 24px', borderRadius: '6px', backgroundColor: '#374151', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Download size={15} /> Download File
                                    </a>
                                </div>
                            </div>

                        </div>
                    </div>
                );
            })()}

            {/* QC REJECT DETAILS MODAL */}
            <QCRejectDetailsModal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                folderId={rejectModalFolderId}
                projectId={effectiveProjectId}
                versionNumber={activeFolder?.version_number}
            />
        </div>
    );
};
