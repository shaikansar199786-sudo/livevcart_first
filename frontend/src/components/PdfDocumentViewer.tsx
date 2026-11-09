import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { Loader2, AlertCircle } from 'lucide-react';

if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

interface PdfDocumentViewerProps {
    url: string;
    fileName?: string;
    fileType?: string;
    activePage?: number;
    onPageCount?: (count: number) => void;
}

interface PageItemProps {
    pdf: pdfjsLib.PDFDocumentProxy;
    pageNumber: number;
    activePage?: number;
}

const PdfPageItem: React.FC<PageItemProps> = ({ pdf, pageNumber, activePage }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const textLayerRef = useRef<HTMLDivElement | null>(null);
    const [renderState, setRenderState] = useState<'idle' | 'loading' | 'rendered' | 'error'>('idle');
    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
    const [shouldRender, setShouldRender] = useState<boolean>(false);

    // Initial pass: quickly get page dimensions so the scroll container has exact height
    useEffect(() => {
        let isMounted = true;
        pdf.getPage(pageNumber).then(page => {
            if (!isMounted) return;
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            const isLandscape = unscaledViewport.width > unscaledViewport.height;
            const targetWidth = isLandscape ? 980 : 850;
            const scale = targetWidth / unscaledViewport.width;
            const viewport = page.getViewport({ scale });
            setPageDimensions({
                width: Math.floor(viewport.width),
                height: Math.floor(viewport.height)
            });
        }).catch(() => {});
        return () => { isMounted = false; };
    }, [pdf, pageNumber]);

    // Check if near activePage
    const isNearActive = Boolean(activePage && Math.abs(pageNumber - activePage) <= 1);

    // Viewport intersection observer: only render canvas & textLayer when visible or near active
    useEffect(() => {
        if (isNearActive) {
            setShouldRender(true);
            return;
        }

        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setShouldRender(true);
            return;
        }

        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setShouldRender(true);
                        observer.disconnect();
                    }
                });
            },
            { rootMargin: '300px 0px 300px 0px' }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [isNearActive]);

    // Render page when shouldRender is true
    useEffect(() => {
        if (!shouldRender || renderState === 'rendered') return;

        let isMounted = true;
        let renderTask: any = null;

        const renderPage = async () => {
            setRenderState('loading');
            try {
                const page = await pdf.getPage(pageNumber);
                if (!isMounted) return;

                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const isLandscape = unscaledViewport.width > unscaledViewport.height;
                const targetWidth = isLandscape ? 980 : 850;
                const scale = targetWidth / unscaledViewport.width;
                const viewport = page.getViewport({ scale });

                const canvas = canvasRef.current;
                if (!canvas) return;

                const ctx = canvas.getContext('2d', { alpha: false });
                if (!ctx) return;

                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

                renderTask = page.render({
                    canvasContext: ctx,
                    transform: transform || undefined,
                    viewport
                });

                await renderTask.promise;
                if (!isMounted) return;

                // Render selectable text layer on top of canvas
                const textLayer = textLayerRef.current;
                if (textLayer) {
                    textLayer.innerHTML = '';
                    textLayer.style.width = `${Math.floor(viewport.width)}px`;
                    textLayer.style.height = `${Math.floor(viewport.height)}px`;
                    textLayer.style.setProperty('--scale-factor', `${viewport.scale}`);

                    const textContent = await page.getTextContent();
                    if (!isMounted) return;

                    await pdfjsLib.renderTextLayer({
                        textContentSource: textContent,
                        container: textLayer,
                        viewport
                    }).promise;
                }

                if (isMounted) {
                    setRenderState('rendered');
                }
            } catch (err: any) {
                if (err?.name !== 'RenderingCancelledException' && isMounted) {
                    console.error(`[PdfPageItem] Error rendering page ${pageNumber}:`, err);
                    setRenderState('error');
                }
            }
        };

        renderPage();

        return () => {
            isMounted = false;
            if (renderTask) {
                try {
                    renderTask.cancel();
                } catch (e) {}
            }
        };
    }, [shouldRender, pdf, pageNumber]);

    return (
        <div
            ref={containerRef}
            id={`pdf-page-${pageNumber}`}
            className="qc-pdf-page-container"
            style={{
                position: 'relative',
                margin: '0 auto 24px auto',
                width: pageDimensions ? `${pageDimensions.width}px` : '100%',
                minHeight: pageDimensions ? `${pageDimensions.height}px` : '750px',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                borderRadius: '4px',
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}
        >
            <style>{`
                .qc-pdf-text-layer {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    overflow: hidden;
                    line-height: 1;
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    transform-origin: 0 0;
                    z-index: 5;
                    opacity: 1 !important;
                }
                .qc-pdf-text-layer :is(span, br) {
                    color: transparent !important;
                    position: absolute;
                    white-space: pre;
                    cursor: text !important;
                    transform-origin: 0% 0%;
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }
                .qc-pdf-text-layer ::selection {
                    background: rgba(37, 99, 235, 0.40) !important;
                    color: transparent !important;
                }
            `}</style>

            {(renderState === 'loading' || renderState === 'idle') && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    zIndex: 1
                }}>
                    <Loader2 size={24} className="animate-spin" color="#3b82f6" />
                    <span>Loading Page {pageNumber}...</span>
                </div>
            )}

            {renderState === 'error' && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#fef2f2',
                    color: '#ef4444',
                    fontSize: '0.82rem',
                    fontWeight: 600
                }}>
                    <AlertCircle size={20} />
                    <span>Failed to render Page {pageNumber}</span>
                </div>
            )}

            <canvas
                ref={canvasRef}
                style={{
                    display: 'block',
                    margin: '0 auto'
                }}
            />

            <div
                ref={textLayerRef}
                className="textLayer qc-pdf-text-layer"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    overflow: 'hidden',
                    lineHeight: 1,
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    zIndex: 5
                }}
            />
        </div>
    );
};

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
    url,
    fileName,
    fileType,
    activePage,
    onPageCount
}) => {
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [pageCount, setPageCount] = useState<number>(0);

    const isImage = Boolean(
        (url && url.match(/\.(png|jpe?g|webp|gif|svg)($|\?)/i)) ||
        (fileName && fileName.match(/\.(png|jpe?g|webp|gif|svg)$/i)) ||
        (fileType && fileType.startsWith('image/'))
    );

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        if (isImage) {
            setLoading(false);
            setPageCount(1);
            if (onPageCount) onPageCount(1);
            return;
        }

        const loadPdf = async () => {
            try {
                let docInit: any = {
                    url,
                    withCredentials: false,
                    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                    cMapPacked: true
                };

                try {
                    const res = await axios.get(url, { responseType: 'arraybuffer' });
                    if (res.data) {
                        docInit = {
                            data: res.data,
                            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                            cMapPacked: true
                        };
                    }
                } catch (fetchErr) {
                    // Fallback to url
                    docInit = {
                        url,
                        withCredentials: false,
                        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                        cMapPacked: true
                    };
                }

                const loadingTask = pdfjsLib.getDocument(docInit);
                const loadedPdf = await loadingTask.promise;
                if (!isMounted) return;

                setPdf(loadedPdf);
                setPageCount(loadedPdf.numPages);
                if (onPageCount) {
                    onPageCount(loadedPdf.numPages);
                }
                setLoading(false);
            } catch (err: any) {
                if (!isMounted) return;
                console.error('[PdfDocumentViewer] Failed to load PDF document:', err);
                setError(err?.message || 'Failed to load PDF document');
                setLoading(false);
            }
        };

        loadPdf();

        return () => {
            isMounted = false;
        };
    }, [url]);

    // Smooth scroll to activePage
    useEffect(() => {
        if (activePage && activePage > 0) {
            const timer = setTimeout(() => {
                const pageEl = document.getElementById(`pdf-page-${activePage}`);
                if (pageEl) {
                    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [activePage]);

    if (isImage) {
        return (
            <div
                id="pdf-page-1"
                className="qc-image-page-container"
                style={{
                    position: 'relative',
                    margin: '0 auto',
                    maxWidth: '900px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    borderRadius: '6px',
                    overflow: 'hidden'
                }}
            >
                <img
                    src={url}
                    alt="QC Preview"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '400px',
                gap: '12px',
                color: '#f8fafc',
                fontFamily: 'Inter, sans-serif'
            }}>
                <Loader2 size={36} className="animate-spin" color="#ea580c" />
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Rendering document with interactive text & highlight selection...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                padding: '30px',
                margin: '20px auto',
                maxWidth: '600px',
                backgroundColor: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontFamily: 'Inter, sans-serif',
                textAlign: 'center'
            }}>
                <AlertCircle size={32} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800 }}>Unable to render PDF document</h4>
                <p style={{ margin: 0, fontSize: '0.84rem' }}>{error}</p>
            </div>
        );
    }

    if (!pdf || pageCount === 0) {
        return null;
    }

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNum => (
                <PdfPageItem
                    key={`pdf-page-item-${pageNum}`}
                    pdf={pdf}
                    pageNumber={pageNum}
                    activePage={activePage}
                />
            ))}
        </div>
    );
};
