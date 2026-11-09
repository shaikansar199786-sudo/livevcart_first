import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { Folder, File, Upload, Plus, Trash2, X, FileText, Image as ImageIcon, Loader2, MessageSquare, Printer } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PdfCanvasViewerProps {
    fileUrl: string;
    activePage: number;
    comments: any[];
    selectedCommentId: number | null;
    onPageCountChange?: (count: number) => void;
}

const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ fileUrl, activePage, comments, selectedCommentId, onPageCountChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [renderError, setRenderError] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;
        const loadPdf = async () => {
            if (!fileUrl) return;
            try {
                setLoading(true);
                setRenderError(null);
                
                // Configure PDF.js workerSrc dynamically
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

                let pdf: any = null;
                try {
                    // Method A: Direct URL load
                    const loadingTask = pdfjsLib.getDocument({
                        url: fileUrl,
                        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                        cMapPacked: true,
                    });
                    pdf = await loadingTask.promise;
                } catch (urlErr) {
                    console.warn("Direct URL load failed, trying ArrayBuffer fetch fallback:", urlErr);
                    // Method B: Binary ArrayBuffer fetch fallback (bypasses CORS worker issues!)
                    const response = await fetch(fileUrl);
                    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const loadingTaskData = pdfjsLib.getDocument({
                        data: new Uint8Array(arrayBuffer),
                        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                        cMapPacked: true,
                    });
                    pdf = await loadingTaskData.promise;
                }

                if (isCancelled) return;
                setPdfDoc(pdf);
                if (onPageCountChange) onPageCountChange(pdf.numPages);
            } catch (err: any) {
                console.error("PDF load error:", err);
                if (!isCancelled) {
                    setRenderError(err.message || 'Failed to load PDF file');
                }
            } finally {
                if (!isCancelled) setLoading(false);
            }
        };
        loadPdf();
        return () => { isCancelled = true; };
    }, [fileUrl]);

    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;
        let isCancelled = false;
        let renderTask: any = null;

        const renderPage = async () => {
            try {
                const targetPageNum = Math.min(Math.max(activePage || 1, 1), pdfDoc.numPages);
                const page = await pdfDoc.getPage(targetPageNum);
                if (isCancelled) return;

                const parentWidth = containerRef.current ? (containerRef.current.clientWidth - 20) : 1000;
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const fitScale = parentWidth > 0 ? (parentWidth / unscaledViewport.width) : 1.5;
                const viewport = page.getViewport({ scale: fitScale });
                const canvas = canvasRef.current!;
                const ctx = canvas.getContext('2d')!;

                // Set canvas dimensions
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;

                renderTask = page.render({ canvasContext: ctx, viewport });
                await renderTask.promise;
                if (isCancelled) return;

                // Render Text Layer
                const textContent = await page.getTextContent();
                const textLayerDiv = textLayerRef.current!;
                textLayerDiv.innerHTML = '';
                textLayerDiv.style.width = `${viewport.width}px`;
                textLayerDiv.style.height = `${viewport.height}px`;
                textLayerDiv.style.position = 'absolute';
                textLayerDiv.style.top = '0';
                textLayerDiv.style.left = '0';
                textLayerDiv.style.pointerEvents = 'none';

                const pageComments = comments.filter(c => Number(c.page_number) === Number(targetPageNum));

                console.log(`[PDF TextLayer] Attempting to highlight on Page ${targetPageNum}. Target Comments:`, pageComments.map(c => ({ id: c.id, target: c.selected_text, page: c.page_number })));

                // Pass 1: Build text layer DOM spans with accurate canvas viewport coordinates
                textContent.items.forEach((item: any) => {
                    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                    const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

                    const span = document.createElement('span');
                    span.style.left = `${tx[4]}px`;
                    span.style.top = `${tx[5] - fontHeight}px`;
                    span.style.fontSize = `${fontHeight}px`;
                    span.style.fontFamily = item.fontName || 'sans-serif';
                    span.style.position = 'absolute';
                    span.style.whiteSpace = 'pre';
                    span.style.transformOrigin = 'left bottom';
                    span.style.color = 'transparent';
                    span.style.lineHeight = '1';
                    span.textContent = item.str || '';
                    textLayerDiv.appendChild(span);
                });

                // Pass 2: Query created spans and build character range index map
                const spans = Array.from(textLayerDiv.querySelectorAll('span')) as HTMLSpanElement[];
                console.log(`[PDF TextLayer] Total text layer spans found for Page ${targetPageNum}:`, spans.length);

                let fullPageText = '';
                const spanRanges: { start: number; end: number; span: HTMLSpanElement }[] = [];

                spans.forEach(span => {
                    const text = span.textContent || '';
                    const start = fullPageText.length;
                    fullPageText += text;
                    const end = fullPageText.length;
                    spanRanges.push({ start, end, span });
                });

                console.log(`[PDF TextLayer] Full Page Text (${fullPageText.length} chars): "${fullPageText.substring(0, 300)}..."`);
                const lowerFullText = fullPageText.toLowerCase();

                // Helper to apply highlight styling to a matched span
                const applyHighlightToSpan = (span: HTMLSpanElement, comm: any) => {
                    const isResolved = comm.status === 'resolved';
                    const isSelected = Number(selectedCommentId) === Number(comm.id);

                    span.style.backgroundColor = isResolved ? '#86efac' : '#fde047';
                    span.style.borderBottom = isResolved ? '3px solid #16a34a' : '3px solid #ea580c';
                    span.style.color = '#000000';
                    span.style.fontWeight = '800';
                    span.style.padding = '2px 4px';
                    span.style.borderRadius = '3px';
                    span.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                    span.style.opacity = '1';
                    span.style.pointerEvents = 'auto';
                    span.style.zIndex = '999';
                    span.setAttribute('data-comment-id', String(comm.id));

                    if (isResolved) {
                        span.classList.add('pdf-comment-highlight-resolved');
                    } else {
                        span.classList.add('pdf-comment-highlight-open');
                    }

                    if (isSelected) {
                        span.classList.add('flash-pulse-animation');
                    }
                    console.log(`[PDF TextLayer] ✅ Highlighted span for Comment #${comm.id} (target: "${comm.selected_text}"): "${span.textContent}"`);
                };

                // Pass 3: Search target text across single & multi-span ranges & render position overlays
                pageComments.forEach(comm => {
                    let posRects: any[] = [];
                    if (comm.position_data) {
                        if (typeof comm.position_data === 'string') {
                            try { posRects = JSON.parse(comm.position_data); } catch (e) {}
                        } else if (Array.isArray(comm.position_data)) {
                            posRects = comm.position_data;
                        }
                    }

                    if (posRects.length > 0) {
                        // Strategy A: Direct Coordinate/Position-Based Highlight Overlays
                        const isResolved = comm.status === 'resolved';
                        const isSelected = Number(selectedCommentId) === Number(comm.id);

                        posRects.forEach((r: any) => {
                            const highlightDiv = document.createElement('div');
                            highlightDiv.style.position = 'absolute';
                            highlightDiv.style.left = `${r.x * viewport.width}px`;
                            highlightDiv.style.top = `${r.y * viewport.height}px`;
                            highlightDiv.style.width = `${r.width * viewport.width}px`;
                            highlightDiv.style.height = `${r.height * viewport.height}px`;
                            highlightDiv.style.backgroundColor = isResolved ? '#86efac' : '#fde047';
                            highlightDiv.style.borderBottom = isResolved ? '3px solid #16a34a' : '3px solid #ea580c';
                            highlightDiv.style.zIndex = '999';
                            highlightDiv.style.pointerEvents = 'auto';
                            highlightDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                            highlightDiv.style.borderRadius = '2px';
                            highlightDiv.style.opacity = '0.75';
                            highlightDiv.setAttribute('data-comment-id', String(comm.id));

                            if (isResolved) {
                                highlightDiv.className = 'pdf-comment-highlight-resolved';
                            } else {
                                highlightDiv.className = 'pdf-comment-highlight-open';
                            }

                            if (isSelected) {
                                highlightDiv.className += ' flash-pulse-animation';
                            }

                            textLayerDiv.appendChild(highlightDiv);
                            console.log(`[PDF Coordinate Overlay] ✅ Rendered position highlight for Comment #${comm.id} at (${(r.x*100).toFixed(1)}%, ${(r.y*100).toFixed(1)}%)`);
                        });
                    } else {
                        // Strategy B: Fallback Text Matching for Legacy Comments
                        const rawTarget = comm.selected_text ? String(comm.selected_text).trim() : '';
                        if (!rawTarget) return;

                        const lowerTarget = rawTarget.toLowerCase();
                        console.log(`[PDF TextLayer] Searching for Legacy Target: "${rawTarget}" on Page ${targetPageNum}`);

                        let matchFound = false;

                        let searchIdx = 0;
                        while (searchIdx < lowerFullText.length) {
                            const foundPos = lowerFullText.indexOf(lowerTarget, searchIdx);
                            if (foundPos === -1) break;

                            matchFound = true;
                            const matchEnd = foundPos + lowerTarget.length;

                            spanRanges.forEach(({ start, end, span }) => {
                                if (start < matchEnd && end > foundPos) {
                                    applyHighlightToSpan(span, comm);
                                }
                            });

                            searchIdx = foundPos + lowerTarget.length;
                        }

                        if (!matchFound) {
                            spans.forEach(span => {
                                const spanText = (span.textContent || '').toLowerCase().trim();
                                if (spanText.length > 0 && (spanText.includes(lowerTarget) || lowerTarget.includes(spanText))) {
                                    applyHighlightToSpan(span, comm);
                                    matchFound = true;
                                }
                            });
                        }

                        if (!matchFound) {
                            const tokens = lowerTarget.split(/[\s,.:;«»'"]+/).filter((t: string) => t.length >= 3);
                            if (tokens.length > 0) {
                                spans.forEach(span => {
                                    const spanText = (span.textContent || '').toLowerCase();
                                    if (tokens.some((tok: string) => spanText.includes(tok))) {
                                        applyHighlightToSpan(span, comm);
                                    }
                                });
                            }
                        }
                    }
                });

                if (selectedCommentId) {
                    setTimeout(() => {
                        const targetSpan = textLayerDiv.querySelector(`[data-comment-id="${selectedCommentId}"]`);
                        if (targetSpan) {
                            targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetSpan.classList.add('flash-pulse-animation');
                        }
                    }, 150);
                }

            } catch (err: any) {
                if (err?.name !== 'RenderingCancelledException') {
                    console.error("Render page error:", err);
                }
            }
        };

        renderPage();

        return () => {
            isCancelled = true;
            if (renderTask) {
                try { renderTask.cancel(); } catch (e) {}
            }
        };
    }, [pdfDoc, activePage, comments, selectedCommentId]);

    return (
        <div ref={containerRef} style={{ position: 'relative', overflowX: 'hidden', overflowY: 'auto', flex: 1, width: '100%', height: '100%', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '10px 0' }}>
            <style>{`
                .pdf-text-layer span.pdf-comment-highlight-open,
                span.pdf-comment-highlight-open {
                    background-color: #fde047 !important;
                    background: #fde047 !important;
                    border-bottom: 3px solid #ea580c !important;
                    color: #000000 !important;
                    font-weight: 800 !important;
                    padding: 2px 4px !important;
                    border-radius: 3px !important;
                    box-shadow: 0 2px 8px rgba(234, 88, 12, 0.5) !important;
                    z-index: 999 !important;
                    position: absolute !important;
                    display: inline-block !important;
                }

                .pdf-text-layer span.pdf-comment-highlight-resolved,
                span.pdf-comment-highlight-resolved {
                    background-color: #86efac !important;
                    background: #86efac !important;
                    border-bottom: 3px solid #16a34a !important;
                    color: #000000 !important;
                    font-weight: 800 !important;
                    padding: 2px 4px !important;
                    border-radius: 3px !important;
                    box-shadow: 0 2px 8px rgba(22, 163, 74, 0.5) !important;
                    z-index: 999 !important;
                    position: absolute !important;
                    display: inline-block !important;
                }

                @keyframes pdfHighlightFlash {
                    0% { outline: 4px solid #ea580c !important; box-shadow: 0 0 20px #ea580c !important; transform: scale(1); }
                    50% { outline: 6px solid #f97316 !important; box-shadow: 0 0 30px #f97316 !important; transform: scale(1.1); }
                    100% { outline: 4px solid #ea580c !important; box-shadow: 0 0 12px #ea580c !important; transform: scale(1); }
                }
                .flash-pulse-animation {
                    animation: pdfHighlightFlash 0.7s ease-in-out infinite alternate !important;
                    z-index: 99999 !important;
                }
            `}</style>
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white', gap: '8px' }}>
                    <Loader2 className="animate-spin" size={24} /> Loading PDF Document...
                </div>
            ) : renderError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fca5a5', gap: '12px', padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>⚠️ Failed to load PDF</div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{renderError}</div>
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fca412', textDecoration: 'underline', fontSize: '0.85rem' }}>
                        Click here to open PDF in new tab
                    </a>
                </div>
            ) : (
                <div style={{ position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', backgroundColor: 'white', height: 'fit-content' }}>
                    <canvas ref={canvasRef} style={{ display: 'block', position: 'relative', zIndex: 1 }} />
                    <div ref={textLayerRef} className="pdf-text-layer" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />
                </div>
            )}
        </div>
    );
};

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
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [uploading, setUploading] = useState(false);

    const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
    const [activePage, setActivePage] = useState<number | null>(1);
    const [selectedCommentId, setSelectedCommentId] = useState<number | null>(null);
    const [numPdfPages, setNumPdfPages] = useState<number>(15);

    const fileRawUrl = previewFile ? `${API_BASE_URL.replace(/\/api\/?$/, '')}/${previewFile.file_path}` : '';
    const fileProxyUrl = previewFile ? `${API_BASE_URL}/file-proxy?file_path=${encodeURIComponent(previewFile.file_path)}` : '';

    // PDF Comments State
    const [pdfComments, setPdfComments] = useState<any[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState<number | string>(1);
    const [newCommentText, setNewCommentText] = useState('');
    const [addingComment, setAddingComment] = useState(false);
    const [pageFilter, setPageFilter] = useState<string>('all');
    const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({});
    const [selectedText, setSelectedText] = useState('');
    const [positionData, setPositionData] = useState<any[] | null>(null);

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
            setActivePage(1);
            setPageNumber(1);
        } else {
            setPdfComments([]);
            setActivePage(1);
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
                position_data: positionData || null,
                user_name: user?.name || 'User',
                user_role: user?.role || 'staff'
            });
            if (res.data.success) {
                setNewCommentText('');
                setSelectedText('');
                setPositionData(null);
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
            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : '';
            if (text) {
                setSelectedText(text);

                // Find the PDF container element
                const pageContainer = document.querySelector('.pdf-text-layer') || document.querySelector('.pdf-page-container');
                if (pageContainer && sel && sel.rangeCount > 0) {
                    const containerRect = pageContainer.getBoundingClientRect();
                    const range = sel.getRangeAt(0);
                    const clientRects = Array.from(range.getClientRects());

                    const relativeRects = clientRects.map(r => ({
                        x: (r.left - containerRect.left) / containerRect.width,
                        y: (r.top - containerRect.top) / containerRect.height,
                        width: r.width / containerRect.width,
                        height: r.height / containerRect.height,
                    })).filter(r => r.width > 0 && r.height > 0);

                    if (relativeRects.length > 0) {
                        setPositionData(relativeRects);
                        console.log("[Coordinate Capture] Captured relative selection rects:", relativeRects);
                    }
                }
                return;
            }
        } catch (e) {
            console.error("Selection capture error:", e);
        }
        alert("To capture text: Highlight text inside the PDF document on the left, then click Capture.");
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

    const userRoleLower = (user?.role || '').toLowerCase();
    const isAuthorizedToOpen = true;
    const isAuthorizedToResolve = true;
    const isAuthorizedToReopen = true;

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
                                            borderRadius: '8px', border: activeFolderId === folder.folder_id ? '1px solid #ffe8c2' : '1px solid transparent', cursor: 'pointer',
                                            backgroundColor: activeFolderId === folder.folder_id ? '#fff9f0' : 'transparent',
                                            color: activeFolderId === folder.folder_id ? '#fca412' : '#4b5563',
                                            fontWeight: activeFolderId === folder.folder_id ? 800 : 500,
                                            textAlign: 'left', transition: 'all 0.2s'
                                        }}
                                    >
                                        <Folder size={18} fill={activeFolderId === folder.folder_id ? '#fca412' : 'none'} color={activeFolderId === folder.folder_id ? '#fca412' : '#64748b'} />
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
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0c1527' }}>
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
                                        style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#fca412', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}
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
                    <div style={{ flex: 1, display: 'flex', padding: '16px', overflow: 'hidden' }}>
                        {/* Clean Full-Width Preview Asset */}
                        <div style={{ flex: 1, width: '100%', height: '100%', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', display: 'flex', gap: '12px', padding: previewFile.file_type === 'application/pdf' ? '8px' : 0 }}>
                            {previewFile.file_type === 'application/pdf' ? (
                                <>
                                    {/* PDF Viewer Container */}

                                    {/* PDF Viewer Container */}
                                    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                                                <span style={{ backgroundColor: '#fca412', color: '#0c1527', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                                                    📜 PDF Document View
                                                </span>
                                                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                                                    Full Document Continuous Scroll
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', border: '1px solid #cbd5e1', borderRadius: '0 0 6px 6px' }}>
                                            <iframe
                                                src={`${fileProxyUrl || fileRawUrl}#toolbar=1&navpanes=0&view=FitH`}
                                                title="Document PDF Viewer"
                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                            />
                                        </div>
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
