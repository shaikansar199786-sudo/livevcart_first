import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { Folder, File, Upload, Plus, Trash2, X, FileText, Image as ImageIcon, Loader2, MessageSquare, Printer } from 'lucide-react';

interface DocumentTabProps {
    projectId: string;
}

interface ProjectFolder {
    folder_id: number;
    name: string;
    created_at: string;
}

interface ProjectFile {
    file_id: number;
    folder_id: number;
    file_name: string;
    file_path: string;
    file_type: string;
    uploader_name: string;
    uploaded_at: string;
}

export const DocumentTab: React.FC<DocumentTabProps> = ({ projectId }) => {
    const { user } = useAuth();
    const [folders, setFolders] = useState<ProjectFolder[]>([]);
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [filesLoading, setFilesLoading] = useState(false);
    
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
    const [activePage, setActivePage] = useState<number | null>(null);
    const [activeSearchText, setActiveSearchText] = useState<string | null>(null);
    const [iframeTimestamp, setIframeTimestamp] = useState<number>(Date.now());

    // PDF Comments State
    const [pdfComments, setPdfComments] = useState<any[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState<number | string>(1);
    const [newCommentText, setNewCommentText] = useState('');
    const [addingComment, setAddingComment] = useState(false);
    const [pageFilter, setPageFilter] = useState<string>('all');
    const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({});
    const [selectedText, setSelectedText] = useState('');

    const fetchPdfComments = async (fileId: number) => {
        setCommentsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/pdf-comments?file_id=${fileId}`);
            if (res.data.success) {
                setPdfComments(res.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch PDF comments', error);
        } finally {
            setCommentsLoading(false);
        }
    };

    useEffect(() => {
        if (previewFile) {
            fetchPdfComments(previewFile.file_id);
            setActivePage(null);
            setActiveSearchText(null);
            setIframeTimestamp(Date.now());
            setPageNumber(1);
        } else {
            setPdfComments([]);
            setActivePage(null);
            setActiveSearchText(null);
            setIframeTimestamp(Date.now());
            setPageNumber(1);
        }
    }, [previewFile]);

    const handleAddPdfComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommentText.trim() || !previewFile) return;
        setAddingComment(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/pdf-comments/add`, {
                file_id: previewFile.file_id,
                page_number: parseInt(String(pageNumber)) || 1,
                comment_text: newCommentText.trim(),
                selected_text: selectedText.trim() || null,
                user_name: user?.name || 'User',
                user_role: user?.role || 'staff'
            });
            if (res.data.success) {
                setNewCommentText('');
                setSelectedText('');
                fetchPdfComments(previewFile.file_id);
            } else {
                alert(res.data.message || 'Failed to add comment');
            }
        } catch (err) {
            alert('Error adding comment');
        } finally {
            setAddingComment(false);
        }
    };

    const handleResolvePdfComment = async (commentId: number) => {
        if (!window.confirm('Are you sure you want to resolve this comment?')) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/pdf-comments/resolve`, {
                comment_id: commentId,
                user_name: user?.name || 'User',
                user_role: user?.role || 'staff'
            });
            if (res.data.success && previewFile) {
                fetchPdfComments(previewFile.file_id);
            }
        } catch (err) {
            alert('Error resolving comment');
        }
    };

    const handleReopenPdfComment = async (commentId: number) => {
        if (!window.confirm('Are you sure you want to reopen this comment?')) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/pdf-comments/reopen`, {
                comment_id: commentId,
                user_name: user?.name || 'User',
                user_role: user?.role || 'staff'
            });
            if (res.data.success && previewFile) {
                fetchPdfComments(previewFile.file_id);
            }
        } catch (err) {
            alert('Error reopening comment');
        }
    };

    const toggleHistoryExpand = (id: number) => {
        setExpandedHistory(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleCaptureSelection = () => {
        try {
            const iframe = document.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                const sel = iframe.contentWindow.getSelection();
                const text = sel ? sel.toString().trim() : '';
                if (text) {
                    setSelectedText(text);
                    return;
                }
            }
        } catch (e) {
            console.error("Frame access error:", e);
        }
        alert("To capture text: Highlight the text inside the PDF on the left, copy it (Ctrl+C), and paste it into the field.");
    };

    const handlePrintComments = () => {
        if (!previewFile) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Popup blocked! Please allow popups to print comments.');
            return;
        }

        const commentsHtml = pdfComments.map(c => `
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.8rem; font-weight: bold; color: #475569;">
                    <span>Page ${c.page_number}</span>
                    <span style="color: ${c.status === 'open' ? '#dc2626' : '#16a34a'}">${c.status === 'open' ? 'OPEN' : 'RESOLVED'}</span>
                </div>
                ${c.selected_text ? `<div style="background-color: ${previewFile.file_type === 'application/pdf' ? '#fef08a' : '#f1f5f9'}; padding: 6px 10px; border-left: 4px solid ${previewFile.file_type === 'application/pdf' ? '#eab308' : '#94a3b8'}; font-size: 0.8rem; color: ${previewFile.file_type === 'application/pdf' ? '#854d0e' : '#475569'}; font-weight: ${previewFile.file_type === 'application/pdf' ? 'bold' : 'normal'}; margin-bottom: 8px; border-radius: 4px;"><strong>Correction target:</strong> "${c.selected_text}"</div>` : ''}
                <p style="margin: 0 0 10px 0; font-size: 0.95rem; color: #1e293b; white-space: pre-wrap;">${c.comment_text}</p>
                <div style="border-top: 1px dashed #cbd5e1; padding-top: 8px; font-size: 0.75rem; color: #64748b;">
                    <strong>History Log:</strong>
                    <div style="margin-top: 4px; padding-left: 8px; border-left: 2px solid #cbd5e1;">
                        ${(c.history || []).map(h => `
                            <div style="margin-bottom: 4px;">
                                <span style="font-weight: 600;">${h.action.toUpperCase()}</span> by ${h.user_name} (${h.user_role}) on ${new Date(h.created_at).toLocaleString('en-IN')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        const html = `
            <html>
                <head>
                    <title>Comments Report - ${previewFile.file_name}</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            color: #1e293b;
                            margin: 40px;
                        }
                        .header {
                            border-bottom: 2px solid #253b50;
                            padding-bottom: 16px;
                            margin-bottom: 24px;
                        }
                        .title {
                            font-size: 1.5rem;
                            font-weight: bold;
                            color: #253b50;
                            margin: 0 0 8px 0;
                        }
                        .meta {
                            font-size: 0.85rem;
                            color: #64748b;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2 class="title">PDF Correction Comments Report</h2>
                        <div class="meta">
                            <strong>File Name:</strong> ${previewFile.file_name} <br/>
                            <strong>Generated On:</strong> ${new Date().toLocaleString('en-IN')}
                        </div>
                    </div>
                    <div>
                        ${pdfComments.length === 0 ? '<p>No comments on this document yet.</p>' : commentsHtml}
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.onafterprint = function() {
                                window.close();
                            };
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const isAuthorizedToOpen = ['admin', 'd1', 'site_inspector', 'site_inspection'].includes(user?.role || '');
    const isAuthorizedToResolve = ['admin', 'd1', 'site_inspector', 'site_inspection'].includes(user?.role || '');
    const isAuthorizedToReopen = ['admin', 'site_inspector', 'site_inspection'].includes(user?.role || '');

    // Notes State
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => {
        fetchFolders();
        fetchNotes();
    }, [projectId]);

    useEffect(() => {
        if (activeFolderId) {
            fetchFiles(activeFolderId);
        } else {
            setFiles([]);
        }
    }, [activeFolderId]);

    const fetchNotes = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/documents/notes?project_id=${projectId}`);
            if (response.data.success) {
                setNotes(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch project notes', error);
        }
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.trim()) return;
        setSavingNote(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/documents/notes`, {
                project_id: projectId,
                note_text: newNote.trim(),
                user_id: user?.user_id || 1
            });
            if (response.data.success) {
                setNewNote('');
                fetchNotes();
            } else {
                alert(response.data.message || 'Failed to add note');
            }
        } catch (error) {
            alert('Error saving note');
        } finally {
            setSavingNote(false);
        }
    };

    const fetchFolders = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/documents?project_id=${projectId}`);
            if (response.data.success) {
                setFolders(response.data.data);
                if (response.data.data.length > 0 && !activeFolderId) {
                    setActiveFolderId(response.data.data[0].folder_id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch folders:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFiles = async (folderId: number) => {
        try {
            setFilesLoading(true);
            const response = await axios.get(`${API_BASE_URL}/documents?folder_id=${folderId}`);
            if (response.data.success) {
                setFiles(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch files:', error);
        } finally {
            setFilesLoading(false);
        }
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/documents`, {
                project_id: projectId,
                name: newFolderName
            });
            if (response.data.success) {
                setNewFolderName('');
                setShowFolderModal(false);
                fetchFolders();
            } else {
                alert('Failed to create folder');
            }
        } catch (error) {
            alert('Error creating folder');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !activeFolderId) return;
        
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', projectId);
        formData.append('folder_id', activeFolderId.toString());
        formData.append('user_id', user?.user_id?.toString() || '');

        setUploading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/documents/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                fetchFiles(activeFolderId);
            } else {
                alert(response.data.message || 'Failed to upload file');
            }
        } catch (error) {
            alert('Error uploading file');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Top Section: Documents & Folders Container */}
            <div style={{ display: 'flex', gap: '24px', height: '520px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                
                {/* Sidebar: Folders */}
                <div style={{ width: '280px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>Folders</h3>
                        <button 
                            onClick={() => setShowFolderModal(true)}
                            style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#111827', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                        {folders.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginTop: '40px' }}>
                                No folders yet.<br/>Create one to start uploading.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {folders.map(folder => (
                                    <button
                                        key={folder.folder_id}
                                        onClick={() => setActiveFolderId(folder.folder_id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                                            borderRadius: '8px', border: 'none', cursor: 'pointer',
                                            backgroundColor: activeFolderId === folder.folder_id ? '#e0e7ff' : 'transparent',
                                            color: activeFolderId === folder.folder_id ? '#3730a3' : '#4b5563',
                                            fontWeight: activeFolderId === folder.folder_id ? 600 : 500,
                                            textAlign: 'left', transition: 'all 0.2s'
                                        }}
                                    >
                                        <Folder size={18} fill={activeFolderId === folder.folder_id ? '#818cf8' : 'none'} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Area: Files */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                    {activeFolderId ? (
                        <>
                            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#111827' }}>
                                    {folders.find(f => f.folder_id === activeFolderId)?.name}
                                </h3>
                                <div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                        style={{ display: 'none' }} 
                                        accept="*" 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#111827', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}
                                    >
                                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                        {uploading ? 'Uploading...' : 'Upload File'}
                                    </button>
                                </div>
                            </div>
                            
                            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                                {filesLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" /></div>
                                ) : files.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.95rem', marginTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '24px', backgroundColor: '#f3f4f6', borderRadius: '50%', display: 'inline-block' }}>
                                            <Upload size={32} color="#9ca3af" />
                                        </div>
                                        <p>This folder is empty.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                                        {files.map(file => {
                                            const isPdf = file.file_type === 'application/pdf';
                                            return (
                                                <div 
                                                    key={file.file_id} 
                                                    style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', position: 'relative', cursor: 'pointer', transition: 'box-shadow 0.2s', backgroundColor: 'white' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                                                    onClick={() => setPreviewFile(file)}
                                                >
                                                    <div style={{ height: '140px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb' }}>
                                                        {isPdf ? (
                                                            <FileText size={48} color="#ef4444" />
                                                        ) : (
                                                            <div style={{ width: '100%', height: '100%', backgroundImage: `url(${API_BASE_URL.replace(/\/api\/?$/, '')}/${file.file_path})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                                                        )}
                                                    </div>
                                                    <div style={{ padding: '12px' }}>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.file_name}>
                                                            {file.file_name}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                                            By {file.uploader_name || 'Sales Representative'}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
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

            {/* Bottom Section: Project Notes & Remarks */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <MessageSquare size={20} color="#253b50" />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Project Notes & Remarks</h3>
                </div>

                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <textarea
                        rows={2}
                        required
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Enter project notes, requirements, or design remarks..."
                        style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', resize: 'vertical' }}
                    />
                    <button
                        type="submit"
                        disabled={savingNote || !newNote.trim()}
                        style={{
                            backgroundColor: '#253b50', color: 'white', padding: '0 24px', borderRadius: '8px', border: 'none',
                            fontWeight: 600, cursor: newNote.trim() ? 'pointer' : 'not-allowed', opacity: newNote.trim() ? 1 : 0.6,
                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem'
                        }}
                    >
                        {savingNote ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Save Note
                    </button>
                </form>

                {/* List of Saved Notes */}
                {notes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '8px', fontSize: '0.9rem' }}>
                        No project notes saved yet. Enter a note above to record project remarks.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {notes.map((note: any) => (
                            <div key={note.id} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.88rem' }}>{note.user_name || 'Team Member'}</span>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(note.created_at).toLocaleString('en-IN')}</span>
                                </div>
                                <p style={{ margin: 0, color: '#334155', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note.note_text}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Folder Modal */}
            {showFolderModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#111827' }}>Create New Folder</h3>
                        <form onSubmit={handleCreateFolder}>
                            <input 
                                type="text" 
                                autoFocus
                                required
                                placeholder="e.g. Floor Plans, Renders"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', marginBottom: '20px' }}
                            />
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowFolderModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 500 }}>Cancel</button>
                                <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {submitting && <Loader2 size={14} className="animate-spin" />} Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* File Preview Modal */}
            {previewFile && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', zIndex: 1200 }}>
                    <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827' }}>
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 500 }}>{previewFile.file_name}</h3>
                        <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                    </div>
                    <div style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', overflow: 'hidden' }}>
                        {/* Left Side: Preview Asset (70% width) */}
                        <div style={{ flex: 7, height: '100%', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', display: 'flex', gap: '16px', padding: previewFile.file_type === 'application/pdf' ? '12px' : 0 }}>
                            {previewFile.file_type === 'application/pdf' ? (
                                <>
                                    {/* Page Navigator Strip */}
                                    <div style={{ width: '60px', display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid #e2e8f0', paddingRight: '12px', overflowY: 'auto', height: '100%' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b', textAlign: 'center', marginBottom: '4px' }}>Page</span>
                                        {Array.from({ length: 50 }, (_, i) => i + 1).map(pNum => {
                                            const isCurrent = activePage === pNum;
                                            const hasComments = pdfComments.some(c => c.page_number === pNum);
                                            return (
                                                <button
                                                    key={`page-nav-${pNum}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setActivePage(pNum);
                                                        setActiveSearchText(null);
                                                        setIframeTimestamp(Date.now());
                                                        setPageNumber(pNum);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 0',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold',
                                                        border: isCurrent ? '2px solid #253b50' : '1px solid #cbd5e1',
                                                        borderRadius: '6px',
                                                        backgroundColor: isCurrent ? '#253b50' : (hasComments ? '#eff6ff' : 'white'),
                                                        color: isCurrent ? 'white' : (hasComments ? '#1e40af' : '#475569'),
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        position: 'relative',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    {pNum}
                                                    {hasComments && !isCurrent && (
                                                        <span style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%' }} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* PDF iframe */}
                                    <div style={{ flex: 1, height: '100%' }}>
                                        <iframe 
                                            key="pdf-iframe-viewer"
                                            src={`${API_BASE_URL.replace(/\/api\/?$/, '')}/${previewFile.file_path}?t=${iframeTimestamp}${
                                                activePage 
                                                    ? `#page=${activePage}${activeSearchText ? `&search="${encodeURIComponent(activeSearchText)}"` : ''}` 
                                                    : ''
                                            }`} 
                                            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '6px' }}
                                            title={previewFile.file_name}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <img 
                                        src={`${API_BASE_URL.replace(/\/api\/?$/, '')}/${previewFile.file_path}`} 
                                        alt={previewFile.file_name}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right Side: Commentary side-panel (30% width) */}
                        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                                        {previewFile.file_type === 'application/pdf' ? 'PDF Comments' : 'Document Comments'}
                                    </h4>
                                    {pdfComments.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handlePrintComments}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#253b50', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                            title="Export comments to PDF report"
                                        >
                                            <Printer size={12} /> PDF
                                        </button>
                                    )}
                                </div>
                                {previewFile.file_type === 'application/pdf' && (
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                        {/* Go to PDF Page */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Go to Page:</span>
                                            <input
                                                type="number"
                                                min={1}
                                                placeholder="Page"
                                                value={activePage || ''}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setActivePage(val > 0 ? val : null);
                                                    setActiveSearchText(null);
                                                    setIframeTimestamp(Date.now());
                                                }}
                                                style={{ width: '60px', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                                            />
                                        </div>

                                        {/* Filter Comments by Page */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Filter:</span>
                                            <select
                                                value={pageFilter}
                                                onChange={(e) => setPageFilter(e.target.value)}
                                                style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                                            >
                                                <option value="all">All Pages</option>
                                                {Array.from(new Set(pdfComments.map(c => c.page_number))).sort((a,b) => a-b).map(page => (
                                                    <option key={`opt-${page}`} value={String(page)}>Page {page}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Add Comment Form (site_inspector, d1, admin only) */}
                            {isAuthorizedToOpen && (
                                <form onSubmit={handleAddPdfComment} style={{ marginBottom: '20px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                                    {previewFile.file_type === 'application/pdf' && (
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Page No:</span>
                                            <input
                                                type="number"
                                                min={1}
                                                required
                                                value={pageNumber}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPageNumber(val);
                                                    const parsed = parseInt(val);
                                                    if (parsed > 0) {
                                                        setActivePage(parsed);
                                                        setActiveSearchText(null);
                                                        setIframeTimestamp(Date.now());
                                                    }
                                                }}
                                                style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                                            />
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Selected Text / spelling mistake (optional):</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="Copy & paste or highlight & click Capture..."
                                                value={selectedText}
                                                onChange={(e) => setSelectedText(e.target.value)}
                                                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                                            />
                                            {previewFile.file_type === 'application/pdf' && (
                                                <button
                                                    type="button"
                                                    onClick={handleCaptureSelection}
                                                    style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600, color: 'white', backgroundColor: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                    title="Capture selected text from PDF"
                                                >
                                                    Capture
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Correction Remark / Comment:</span>
                                        <textarea
                                            rows={2}
                                            required
                                            placeholder={previewFile.file_type === 'application/pdf' ? "Add page specific correction note..." : "Add document correction note..."}
                                            value={newCommentText}
                                            onChange={(e) => setNewCommentText(e.target.value)}
                                            style={{ width: '100%', padding: '8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical' }}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={addingComment || !newCommentText.trim()}
                                        style={{ width: '100%', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: '#253b50', color: 'white', border: 'none', borderRadius: '6px', cursor: newCommentText.trim() ? 'pointer' : 'not-allowed', opacity: newCommentText.trim() ? 1 : 0.7 }}
                                    >
                                        {addingComment ? 'Submitting...' : 'Add Comment'}
                                    </button>
                                </form>
                            )}

                            {/* Comments List */}
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {commentsLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader2 className="animate-spin" /></div>
                                ) : pdfComments.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '40px', padding: '16px', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                                        No comments on this document yet.
                                    </div>
                                ) : (
                                    (() => {
                                        const filtered = pdfComments.filter(c => previewFile.file_type !== 'application/pdf' || pageFilter === 'all' || String(c.page_number) === pageFilter);
                                        if (filtered.length === 0) {
                                            return (
                                                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '20px' }}>
                                                    No comments matching filter.
                                                </div>
                                            );
                                        }
                                        return filtered.map(c => {
                                            const isOpen = c.status === 'open';
                                            const isActive = previewFile.file_type === 'application/pdf' && activePage === c.page_number && (activeSearchText === c.selected_text || (!activeSearchText && !c.selected_text));
                                            return (
                                                <div 
                                                    key={c.id} 
                                                    onClick={() => {
                                                        if (previewFile.file_type === 'application/pdf') {
                                                            setActivePage(c.page_number);
                                                            setActiveSearchText(c.selected_text || null);
                                                            setIframeTimestamp(Date.now());
                                                        }
                                                    }}
                                                    style={{ 
                                                        padding: '12px', 
                                                        border: isActive ? '2px solid #253b50' : '1px solid #e2e8f0', 
                                                        borderRadius: '8px', 
                                                        backgroundColor: isActive ? '#eff6ff' : (isOpen ? '#fffbeb' : '#f8fafc'), 
                                                        transition: 'all 0.2s',
                                                        cursor: previewFile.file_type === 'application/pdf' ? 'pointer' : 'default',
                                                        boxShadow: isActive ? '0 4px 6px -1px rgba(37,59,80,0.15)' : 'none'
                                                    }}
                                                    title={previewFile.file_type === 'application/pdf' ? "Click to jump to this page in PDF" : undefined}
                                                >
                                                    {/* Top Metadata */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        {previewFile.file_type === 'application/pdf' ? (
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '4px' }}>
                                                                Page {c.page_number}
                                                            </span>
                                                        ) : (
                                                            <span />
                                                        )}
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: isOpen ? '#fef2f2' : '#f0fdf4', color: isOpen ? '#991b1b' : '#166534' }}>
                                                            {isOpen ? 'Open' : 'Resolved'}
                                                        </span>
                                                    </div>

                                                    {/* Reference/Correction Text Box */}
                                                    {c.selected_text && (
                                                        <div style={{ 
                                                            backgroundColor: previewFile.file_type === 'application/pdf' ? '#fef08a' : '#f1f5f9', 
                                                            borderLeft: previewFile.file_type === 'application/pdf' ? '4px solid #eab308' : '4px solid #94a3b8', 
                                                            padding: '6px 10px', 
                                                            borderRadius: '4px', 
                                                            marginBottom: '8px', 
                                                            fontSize: '0.8rem', 
                                                            fontStyle: 'italic', 
                                                            color: previewFile.file_type === 'application/pdf' ? '#854d0e' : '#475569', 
                                                            fontWeight: previewFile.file_type === 'application/pdf' ? 600 : 'normal' 
                                                        }}>
                                                            <strong>Correction target:</strong> "{c.selected_text}"
                                                        </div>
                                                    )}

                                                    {/* Comment Text */}
                                                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                                        {c.comment_text}
                                                    </p>

                                                    {/* Action Buttons */}
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                                        {isOpen && isAuthorizedToResolve && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleResolvePdfComment(c.id); }}
                                                                style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                Resolve
                                                            </button>
                                                        )}
                                                        {!isOpen && isAuthorizedToReopen && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleReopenPdfComment(c.id); }}
                                                                style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#854d0e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                Reopen
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* History Audit Trail */}
                                                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); toggleHistoryExpand(c.id); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#475569', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                                                        >
                                                            <span>{expandedHistory[c.id] ? 'Hide History' : 'Show History'} ({c.history?.length || 0})</span>
                                                        </button>
                                                        
                                                        {expandedHistory[c.id] && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1' }}>
                                                                {(c.history || []).map((h: any) => (
                                                                    <div key={h.id} style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.3 }}>
                                                                        <span style={{ fontWeight: 600, color: '#334155' }}>
                                                                            {h.action === 'opened' ? 'Opened' : h.action === 'resolved' ? 'Resolved' : 'Reopened'}
                                                                        </span> by <span style={{ fontWeight: 500 }}>{h.user_name}</span> ({h.user_role})
                                                                        <div style={{ color: '#94a3b8', fontSize: '0.62rem' }}>
                                                                            {new Date(h.created_at).toLocaleString('en-IN')}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '16px', backgroundColor: '#111827', textAlign: 'center' }}>
                        <a 
                            href={`${API_BASE_URL.replace(/\/api\/?$/, '')}/${previewFile.file_path}`} 
                            download={previewFile.file_name}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'white', textDecoration: 'none', padding: '8px 24px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500, display: 'inline-block' }}
                        >
                            Download File
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};
