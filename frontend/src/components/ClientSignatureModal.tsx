import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { X, RotateCcw, Check, PenTool } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ClientSignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    projectId?: string | number;
    leadId?: string | number;
    existingSignature?: string;
    onSignatureSaved?: (sigDataUrl: string) => void;
}

export const ClientSignatureModal: React.FC<ClientSignatureModalProps> = ({
    isOpen,
    onClose,
    clientName,
    projectId,
    leadId,
    existingSignature = '',
    onSignatureSaved
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [savedSignature, setSavedSignature] = useState(existingSignature);
    const [saving, setSaving] = useState(false);
    const [mode, setMode] = useState<'draw' | 'view'>(existingSignature ? 'view' : 'draw');

    useEffect(() => {
        if (existingSignature) {
            setSavedSignature(existingSignature);
            setMode('view');
        } else {
            setMode('draw');
        }
    }, [existingSignature, isOpen]);

    // Setup canvas when in draw mode
    useEffect(() => {
        if (!isOpen || mode !== 'draw') return;

        const timer = setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(dpr, dpr);
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
            setHasDrawn(false);
        }, 100);

        return () => clearTimeout(timer);
    }, [isOpen, mode]);

    if (!isOpen) return null;

    const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        setIsDrawing(true);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pos = getCanvasPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pos = getCanvasPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        setHasDrawn(true);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (canvas) {
            try {
                canvas.releasePointerCapture(e.pointerId);
            } catch (err) {}
        }
        setIsDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) {
            alert('Please sign on the canvas before saving.');
            return;
        }

        const dataUrl = canvas.toDataURL('image/png');
        setSaving(true);
        try {
            await axios.post(`${API_BASE_URL}/projects/update-client-signature`, {
                project_id: projectId,
                lead_id: leadId,
                signature: dataUrl
            });

            setSavedSignature(dataUrl);
            setMode('view');
            if (onSignatureSaved) {
                onSignatureSaved(dataUrl);
            }
            alert('✅ Client signature saved successfully!\n\nIt will now automatically appear on all Quotation and Agreement PDFs for this project.');
            onClose();
        } catch (err: any) {
            console.error('Error saving signature:', err);
            // Fallback: try via leads endpoint
            try {
                await axios.post(`${API_BASE_URL}/leads/update-client-signature`, {
                    project_id: projectId,
                    lead_id: leadId,
                    signature: dataUrl
                });
                setSavedSignature(dataUrl);
                setMode('view');
                if (onSignatureSaved) {
                    onSignatureSaved(dataUrl);
                }
                alert('✅ Client signature saved successfully!');
                onClose();
            } catch (err2) {
                alert('Failed to save signature. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1.5px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#fafafa'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <PenTool size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                Client Signature
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                                For <strong>{clientName || 'Valued Client'}</strong> {projectId ? `(ID: ${projectId})` : ''}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px' }}>
                    {mode === 'view' && savedSignature ? (
                        <div>
                            <div style={{
                                padding: '16px',
                                backgroundColor: '#f8fafc',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    ✓ Active Client Signature
                                </span>
                                <div style={{
                                    height: '140px',
                                    margin: '12px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1'
                                }}>
                                    <img
                                        src={savedSignature}
                                        alt="Client Signature"
                                        style={{ maxHeight: '110px', maxWidth: '90%', objectFit: 'contain' }}
                                    />
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                                    Signatory: <strong>{clientName}</strong>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '14px', lineHeight: 1.5, textAlign: 'center' }}>
                                This signature is active and automatically placed on all <strong>Quotation PDFs</strong> and <strong>Agreement PDFs</strong>.
                            </p>

                            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <button
                                    onClick={() => setMode('draw')}
                                    style={{
                                        padding: '9px 18px',
                                        borderRadius: '20px',
                                        border: '1.5px solid #ea580c',
                                        backgroundColor: '#fff7ed',
                                        color: '#ea580c',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <RotateCcw size={15} /> Re-draw / Update Signature
                                </button>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '9px 20px',
                                        borderRadius: '20px',
                                        border: 'none',
                                        backgroundColor: '#0f172a',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                                Please ask the client to draw their signature below using finger (touchscreen) or mouse.
                            </p>

                            <div style={{
                                position: 'relative',
                                border: '2px dashed #93c5fd',
                                borderRadius: '12px',
                                backgroundColor: '#fbfcfe',
                                overflow: 'hidden',
                                touchAction: 'none'
                            }}>
                                <canvas
                                    ref={canvasRef}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={handlePointerUp}
                                    style={{
                                        width: '100%',
                                        height: '180px',
                                        display: 'block',
                                        cursor: 'crosshair',
                                        touchAction: 'none'
                                    }}
                                />

                                {/* Guide line */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '32px',
                                    left: '24px',
                                    right: '24px',
                                    borderBottom: '1px solid #cbd5e1',
                                    pointerEvents: 'none',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-end',
                                    paddingBottom: '4px'
                                }}>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                        Sign above this line
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                        ✍️ Client
                                    </span>
                                </div>
                            </div>

                            {/* Canvas Controls */}
                            <div style={{
                                marginTop: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <button
                                    onClick={handleClear}
                                    disabled={!hasDrawn}
                                    style={{
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        backgroundColor: '#f8fafc',
                                        color: '#64748b',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        cursor: hasDrawn ? 'pointer' : 'not-allowed',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        opacity: hasDrawn ? 1 : 0.5
                                    }}
                                >
                                    <RotateCcw size={14} /> Clear
                                </button>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {savedSignature && (
                                        <button
                                            onClick={() => setMode('view')}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                border: '1.5px solid #d1d5db',
                                                backgroundColor: 'white',
                                                color: '#374151',
                                                fontWeight: 700,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Keep Existing
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={!hasDrawn || saving}
                                        style={{
                                            padding: '8px 20px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: (hasDrawn && !saving) ? '#16a34a' : '#94a3b8',
                                            color: '#ffffff',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: (hasDrawn && !saving) ? 'pointer' : 'not-allowed',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            boxShadow: hasDrawn ? '0 2px 6px rgba(22, 163, 74, 0.3)' : 'none'
                                        }}
                                    >
                                        <Check size={16} /> {saving ? 'Saving...' : 'Save Signature'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
