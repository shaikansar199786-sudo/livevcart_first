// src/pages/PrintVendorQuotaView.tsx
// Dedicated unauthenticated print route rendered by Puppeteer to generate Vendor Quota & Service Agreement vector PDF.
// Fetches vendor items, project details, and renders pixel-perfect print layout.
// Emits #print-ready sentinel element when rendering is complete.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import liveLogo from '../assets/1.png';
import liveCartSignature from '../assets/LIVE CART SINGTU.png';

interface VendorItem {
    particulars: string;
    description?: string;
    brand?: string;
    width?: number | string;
    height?: number | string;
    sft?: number | string;
    unit: string;
    quantity: number;
    rate: number;
    vendor_rate?: number;
    amount: number;
    vendor_amount?: number;
    discount?: number;
    vendor_discount?: number;
    discount_percent?: number;
    gst?: number;
    vendor_gst?: number;
    gst_rate?: number;
    date?: string;
    source?: string;
    isHeader?: boolean;
    dimensions?: string;
    dim_type?: string;
    pricing_mode?: string;
    depth?: number | string;
}

const computeSqft = (widthStr?: any, heightStr?: any, depthStr?: any) => {
    let w = parseFloat(String(widthStr || '0').replace(/[^0-9.]/g, '')) || 0;
    let h = parseFloat(String(heightStr || '0').replace(/[^0-9.]/g, '')) || 0;
    let d = parseFloat(String(depthStr || '0').replace(/[^0-9.]/g, '')) || 0;

    if ((w === 0 || h === 0) && typeof widthStr === 'string') {
        const matchW = widthStr.match(/W\s*:\s*([0-9.]+)/i);
        const matchH = widthStr.match(/H\s*:\s*([0-9.]+)/i);
        const matchD = widthStr.match(/D\s*:\s*([0-9.]+)/i);
        if (matchW) w = parseFloat(matchW[1]) || 0;
        if (matchH) h = parseFloat(matchH[1]) || 0;
        if (matchD) d = parseFloat(matchD[1]) || 0;
    }

    if (w > 0 && h > 0) {
        if (d > 0) {
            return (w * h * d) / 27000000;
        }
        return (w * h) / 90000;
    }
    return 0;
};

export const PrintVendorQuotaView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const vendorName = searchParams.get('vendor') || 'Vendor';
    const projectId = searchParams.get('project_id') || '1';
    const apiBase = searchParams.get('api') || 'http://localhost/livrcart/demoark/api';

    const [items, setItems] = useState<VendorItem[]>([]);
    const [projectDetails, setProjectDetails] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [ready, setReady] = useState<boolean>(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await axios.get(`${apiBase}/vendor-quotas/project-items?vendor=${encodeURIComponent(vendorName)}&project_id=${encodeURIComponent(projectId)}`);
                if (res.data?.success) {
                    let combined: VendorItem[] = [];

                    if (res.data.saved_quotation?.items_data && Array.isArray(res.data.saved_quotation.items_data) && res.data.saved_quotation.items_data.length > 0) {
                        combined = res.data.saved_quotation.items_data.map((i: any) => {
                            const isHeader = i.brand === 'HEADER';
                            const rate = parseFloat(i.vendor_rate ?? i.rate ?? i.original_rate ?? i.rate_per_sft ?? 0);
                            const amount = parseFloat(i.vendor_amount ?? i.amount ?? i.original_amount ?? 0);
                            return {
                                particulars: i.particulars || i.item_name || 'Material Item',
                                unit: i.unit || 'Nos',
                                quantity: parseFloat(i.quantity || 1),
                                rate,
                                amount,
                                discount: parseFloat(i.vendor_discount ?? i.discount_percent ?? i.original_discount ?? 0),
                                gst: parseFloat(i.vendor_gst ?? i.gst_rate ?? i.original_gst ?? 18),
                                brand: i.brand,
                                isHeader
                            };
                        });
                    } else {
                        combined = [
                            ...(res.data.inventory_items || []).map((i: any) => ({
                                particulars: i.item_name || 'Material Item',
                                unit: i.unit || 'Nos',
                                quantity: parseFloat(i.quantity || 1),
                                rate: parseFloat(i.rate || 0),
                                amount: parseFloat(i.total || 0),
                                date: i.invoice_date,
                                source: 'Inventory / Purchase'
                            })),
                            ...(res.data.finance_items || []).map((f: any) => ({
                                particulars: f.description || f.category || 'Service / Expense',
                                unit: 'Job',
                                quantity: 1,
                                rate: parseFloat(f.amount || 0),
                                amount: parseFloat(f.amount || 0),
                                date: f.transaction_date,
                                source: f.category || 'Finance'
                            }))
                        ];
                    }

                    setItems(combined);

                    const sample = (res.data.inventory_items && res.data.inventory_items[0]) || (res.data.finance_items && res.data.finance_items[0]);
                    if (sample) {
                        setProjectDetails({
                            project_id: sample.project_id || projectId,
                            project_name: sample.project_name || ('Project ' + projectId),
                            client_id: sample.client_id || sample.project_id || projectId,
                            project_type: sample.project_type || 'Interior Project'
                        });
                    } else {
                        setProjectDetails({
                            project_id: projectId,
                            project_name: 'Project ' + projectId,
                            client_id: projectId,
                            project_type: 'Interior Project'
                        });
                    }
                } else {
                    setItems([]);
                    setProjectDetails({
                        project_id: projectId,
                        project_name: 'Project ' + projectId,
                        client_id: projectId,
                        project_type: 'Interior Project'
                    });
                }
            } catch (err: any) {
                console.error('PrintVendorQuotaView load error:', err);
                setError(err.message || 'Failed to fetch vendor quota data');
            } finally {
                setLoading(false);
            }
        };

loadData();
    }, [vendorName, projectId, apiBase]);

    useEffect(() => {
        const origBodyBg = document.body.style.backgroundColor;
        const origDocBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.background = '#ffffff';
        document.documentElement.style.backgroundColor = '#ffffff';
        document.documentElement.style.background = '#ffffff';

        return () => {
            document.body.style.backgroundColor = origBodyBg;
            document.body.style.background = origBodyBg;
            document.documentElement.style.backgroundColor = origDocBg;
            document.documentElement.style.background = origDocBg;
        };
    }, []);

    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => setReady(true), 400);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    if (error) {
        return (
            <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#ef4444' }}>
                <h2>Vendor Quota PDF Generation Error</h2>
                <p>{error}</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#64748b' }}>
                <h2>Loading Vendor Quota Data...</h2>
            </div>
        );
    }

    const totalAmountSum = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const currentDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div style={{ backgroundColor: '#ffffff', color: '#0c1527', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', lineHeight: 1.6, padding: '30px', boxSizing: 'border-box', minHeight: '100vh', width: '100%' }}>
            <style>{`
                @page {
                    size: A4 portrait;
                    margin: 10mm;
                }
                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                html, body, #root {
                    margin: 0;
                    padding: 0;
                    background: #ffffff !important;
                    background-color: #ffffff !important;
                    height: auto !important;
                    overflow: visible !important;
                }
                .vendor-quota-cover-page {
                    position: relative !important;
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    min-height: 270mm !important;
                    height: 270mm !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    box-sizing: border-box !important;
                    margin-bottom: 0 !important;
                }
                .vendor-quota-part1 {
                    position: relative !important;
                    display: block !important;
                    width: 100% !important;
                    height: auto !important;
                    page-break-before: always !important;
                    break-before: page !important;
                    page-break-after: always !important;
                    break-after: page !important;
                }
                .vendor-agreement-page {
                    page-break-before: always !important;
                    break-before: page !important;
                    position: relative !important;
                    display: block !important;
                    clear: both !important;
                    width: 100% !important;
                    height: auto !important;
                    margin-top: 0 !important;
                    padding-top: 16px !important;
                }
                tr, td, th {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
            `}</style>

            {/* ── PAGE 1: EXECUTIVE COVER PAGE (COVER PAGE ONLY) ── */}
            <div className="vendor-quota-cover-page" style={{ minHeight: '270mm', height: '270mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: '16px 12px 20px 12px', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page', marginBottom: '0' }}>
                {/* Top Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #ea580c', paddingBottom: '14px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img src={liveLogo} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                        <div>
                            <div style={{ fontSize: '15pt', fontWeight: 900, color: '#000000', marginBottom: '2px' }}>Livincart Private Limited</div>
                            <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 500 }}>Official Vendor Work Order &amp; Service Agreement Workspace</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                        <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '4px' }}>
                            <span style={{ marginRight: '10px' }}>📍 Visakhapatnam, Andhra Pradesh – 530020</span>
                            <span>📞 +91 7702312351</span>
                        </div>
                        <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '2px' }}>
                            <span style={{ marginRight: '10px' }}>✉️ contact@livincart.com</span>
                            <span>🌐 www.livincart.com</span>
                        </div>
                    </div>
                </div>

                {/* Center Hero Block */}
                <div style={{ textAlign: 'center', margin: 'auto 0' }}>
                    <img src={liveLogo} alt="Logo Center" style={{ height: '85px', objectFit: 'contain', marginBottom: '16px' }} />
                    <div style={{ fontSize: '13pt', fontWeight: 900, color: '#000000', marginBottom: '10px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                    <div style={{ width: '160px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '10px auto 26px' }} />

                    <h1 style={{ margin: 0, fontSize: '22pt', fontWeight: 900, color: '#000000' }}>OFFICIAL WORK ORDER &amp;</h1>
                    <h1 style={{ margin: '6px 0 0 0', fontSize: '24pt', fontWeight: 900, color: '#ea580c' }}>
                        VENDOR MATERIAL QUOTATION
                    </h1>
                    <div style={{ width: '200px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '14px auto 30px' }} />

                    {/* Details Box */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '28px', border: '2px solid #ea580c', borderRadius: '16px', padding: '16px 36px', backgroundColor: '#ffffff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18pt' }}>🏢</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Vendor Entity</div>
                                <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap' }}>{vendorName}</div>
                            </div>
                        </div>
                        <div style={{ width: '1.5px', height: '34px', backgroundColor: '#fed7aa' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18pt' }}>📋</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Project / Site Ref</div>
                                <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap' }}>{projectDetails?.client_id || projectDetails?.project_id || projectId}</div>
                            </div>
                        </div>
                        <div style={{ width: '1.5px', height: '34px', backgroundColor: '#fed7aa' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18pt' }}>📅</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Date</div>
                                <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap' }}>{currentDateStr}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Contact Card */}
                <div style={{ border: '2px solid #ea580c', borderRadius: '16px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#ea580c', padding: '14px 24px', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9pt', fontWeight: 800 }}>
                            📍 Visakhapatnam, Andhra Pradesh 530020
                        </div>
                        <div style={{ width: '1.5px', height: '18px', backgroundColor: '#ffffff' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9pt', fontWeight: 800 }}>
                            📞 +91 7702312351
                        </div>
                        <div style={{ width: '1.5px', height: '18px', backgroundColor: '#ffffff' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9pt', fontWeight: 800 }}>
                            ✉️ contact@livincart.com
                        </div>
                    </div>
                    <div style={{ backgroundColor: '#fff7ed', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', borderTop: '1.5px solid #fed7aa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                            <span style={{ color: '#ea580c' }}>🌐</span> www.livincart.com
                        </div>
                        <div style={{ width: '1.5px', height: '20px', backgroundColor: '#fed7aa' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                            <span style={{ color: '#ea580c' }}>👤</span> Livincart Procurement Division
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PAGE 2: VENDOR MATERIAL QUOTA BOQ SCOPE BREAKDOWN ── */}
            <div className="vendor-quota-part1">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #0c1527', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                        <img src={liveLogo} alt="LivinCart" style={{ height: '48px', objectFit: 'contain', marginBottom: '6px' }} />
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>LivinCart and Services Private Limited</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Visakhapatnam, Andhra Pradesh</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VENDOR MATERIAL QUOTATION</div>
                        <div style={{ fontSize: '12px', color: '#fca412', fontWeight: 800, marginTop: '4px' }}>REF: VQ-{projectDetails?.project_id || projectId}-{Date.now().toString().slice(-4)}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Date: {currentDateStr}</div>
                    </div>
                </div>

                {/* Vendor & Project Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px', backgroundColor: '#fff9f0', padding: '14px 18px', borderRadius: '10px', border: '1.5px solid #ffe8c2' }}>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#fca412', textTransform: 'uppercase', marginBottom: '4px' }}>VENDOR DETAILS:</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#0c1527' }}>{vendorName}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#fca412', textTransform: 'uppercase', marginBottom: '4px' }}>PROJECT DETAILS:</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#0c1527' }}>{projectDetails?.project_name}</div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>Project ID: {projectDetails?.client_id || projectDetails?.project_id}</div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>Type: {projectDetails?.project_type || 'Interior Project'}</div>
                    </div>
                </div>

                {/* Items BOQ Table */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0c1527', marginBottom: '8px', textTransform: 'uppercase' }}>Scope of Supplies / Material Details</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff' }}>
                                <th style={{ padding: '8px 10px', fontWeight: 800, width: '35px' }}>#</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800, width: '25%' }}>Product Description / Particulars</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800 }}>Shutter Material</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800 }}>Carcass Material</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'center' }}>Dimensions (W × H × D)</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'right' }}>Rate (₹)</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'center' }}>Qty</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'center' }}>Disc %</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'center' }}>GST %</th>
                                <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'right' }}>Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                        No line items recorded for this vendor on this project.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item: any, i: number) => {
                                    if (item.is_subtitle) {
                                        return (
                                            <tr key={i} style={{ backgroundColor: '#fff7ed', borderLeft: '4px solid #ea580c', borderBottom: '1px solid #fed7aa' }}>
                                                <td colSpan={10} style={{ padding: '8px 10px', fontWeight: 900, color: '#c2410c', fontSize: '11px' }}>
                                                    📌 {item.particulars}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#64748b' }}>{i + 1}</td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <div style={{ fontWeight: 800, color: '#0c1527', fontSize: '11px' }}>{item.particulars}</div>
                                                {item.description && (
                                                    <div style={{ fontSize: '9.5px', color: '#475569', marginTop: '2px', whiteSpace: 'pre-line', fontWeight: 500 }}>{item.description}</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: '#475569' }}>{item.brand || item.shutter || '—'}</td>
                                            <td style={{ padding: '8px 10px', color: '#475569' }}>{item.unit || item.carcass || '—'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#334155' }}>
                                                {item.pricing_mode === 'lumpsum' || item.dim_type === 'lumpsum' ? (
                                                    <span style={{ color: '#16a34a', fontWeight: 800, backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0', fontSize: '9px' }}>Lumpsum</span>
                                                ) : (item.width || item.height || item.sft || item.dimensions) ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center', fontSize: '9.5px', lineHeight: 1.2 }}>
                                                        {item.dimensions ? <div>{item.dimensions}</div> : (
                                                            <>
                                                                {item.width && <div>W: {item.width}</div>}
                                                                {item.height && <div>H: {item.height}</div>}
                                                                {item.depth ? <div>D: {item.depth}</div> : (item.sft && <div>D: {item.sft}</div>)}
                                                            </>
                                                        )}
                                                        {(() => {
                                                            const sqft = computeSqft(item.width || (item.dimensions as string), item.height, item.depth || item.sft);
                                                            return sqft > 0 ? (
                                                                <span style={{ fontSize: '8.5px', color: '#ea580c', fontWeight: 800, backgroundColor: '#fff7ed', padding: '1px 5px', borderRadius: '3px', border: '1px solid #fed7aa', marginTop: '1px' }}>
                                                                    {sqft.toFixed(2)} SFT
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{(item.vendor_rate ?? item.rate ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{item.quantity || item.qty || 1}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.vendor_discount ?? item.discount ?? item.discount_percent ?? 0}%</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.vendor_gst ?? item.gst ?? item.gst_rate ?? 18}%</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0c1527' }}>₹{(item.vendor_amount ?? item.amount ?? item.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Subtotal / Grand Total Summary */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                    <div style={{ width: '300px', backgroundColor: '#fff9f0', padding: '14px 18px', borderRadius: '10px', border: '1.5px solid #ffe8c2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px', color: '#475569' }}>
                            <span>Sub Total:</span>
                            <span style={{ fontWeight: 700 }}>₹{totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', fontWeight: 900, color: '#0c1527', borderTop: '2px solid #ffe8c2', marginTop: '4px' }}>
                            <span>Grand Total:</span>
                            <span style={{ color: '#fca412' }}>₹{totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PART 2: ATTACHED VENDOR SERVICE AGREEMENT (EXACT MATCH TO REFERENCE PDF) ── */}
            <div className="vendor-agreement-page page-break-before" style={{ pageBreakBefore: 'always', breakBefore: 'page', position: 'relative', display: 'block', clear: 'both', paddingTop: '16px', borderTop: '4px solid #0c1527' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0c1527', textTransform: 'uppercase', marginBottom: '4px' }}>
                        LIVINCART VENDOR SERVICE AGREEMENT
                    </h2>
                </div>

                <div style={{ fontSize: '10.5px', color: '#1e293b', lineHeight: 1.6, textAlign: 'justify' }}>
                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>1. Parties</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        This <strong>Master Interior Vendor Service Agreement ("Agreement")</strong> is made on {new Date().getDate()} day of {new Date().toLocaleDateString('en-IN', { month: 'long' })}, 20{new Date().getFullYear().toString().slice(-2)} ("Effective Date"),
                    </p>
                    <p style={{ margin: '0 0 10px 0', fontWeight: 800 }}>
                        BY AND BETWEEN
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        <strong>LivinCart and Services Private Limited</strong>, a company incorporated under the <strong>Companies Act, 2013</strong>, having its registered office at Visakhapatnam, Andhra Pradesh (hereinafter referred to as the "<strong>Company</strong>", which expression shall include its successors and permitted assigns);
                    </p>
                    <p style={{ margin: '0 0 10px 0', fontWeight: 800 }}>
                        AND
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        <strong>M/s. {vendorName}</strong>, having its principal place of business at Visakhapatnam, Andhra Pradesh (hereinafter referred to as the "<strong>Vendor</strong>", which expression shall include its successors and permitted assigns).
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Company and the Vendor are hereinafter collectively referred to as the "<strong>Parties</strong>" and individually as a "<strong>Party</strong>".
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        <strong>WHEREAS</strong>, the Company desires to engage the Vendor for interior carpentry, furniture manufacturing, installation, and related services on a <strong>non-exclusive, project-specific basis</strong> under Work Orders issued by the Company.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>2. Scope of Services</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall provide skilled labour, supervision, tools, equipment, and all other resources necessary for the execution of interior carpentry and furniture-related services assigned by the Company from time to time under separate Work Orders.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Services may include, but shall not be limited to, the manufacture, fabrication, assembly, transportation, installation, dismantling, repair, modification, maintenance, and commissioning of modular kitchens, wardrobes, TV units, beds, sofas, dining tables, office furniture, storage units, wall panelling, wooden partitions, false ceiling wooden works, cabinets, shelving units, wooden doors, windows, and all other residential, commercial, and institutional interior carpentry and furniture works.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall execute all Services strictly in accordance with the approved drawings, designs, specifications, Bill of Quantities (BOQ), quality standards, timelines, and written instructions issued by the Company. The Vendor shall not undertake any additional or variation work without the Company's prior written approval.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        The Company reserves the right to modify, increase, reduce, or omit any part of the scope of work by issuing written instructions or revised Work Orders, and the Vendor shall comply with such instructions in accordance with the terms of this Agreement.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>3. Vendor Responsibilities</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall provide competent and adequately trained manpower, qualified supervisors, tools, machinery, equipment, and appropriate Personal Protective Equipment (PPE) necessary for the proper and timely execution of the Services. The Vendor shall ensure that all personnel deployed at the Project Site are skilled, experienced, and capable of performing the assigned work in accordance with the approved drawings, specifications, quality standards, and the Company's instructions.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall maintain discipline, professionalism, and proper conduct at the Project Site and shall ensure that its employees comply with all applicable labour laws, safety regulations, and statutory requirements. The Vendor shall maintain cleanliness at the Project Site, prevent any nuisance or inconvenience to the Customer or occupants, and take all reasonable precautions to safeguard the Project Site, Company property, Customer property, materials, tools, and equipment from loss, theft, damage, or misuse.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall immediately notify the Company of any accident, injury, unsafe condition, delay, material shortage, quality issue, or any event that may adversely affect the execution or completion of the Services. The Vendor shall be solely responsible for the acts, omissions, negligence, and conduct of its employees, agents, and representatives and shall remain liable for any loss, damage, claim, or liability arising therefrom.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        The Vendor shall comply with the provisions of the <strong>Indian Contract Act, 1872</strong>, applicable labour and safety laws, and all other statutory requirements in force from time to time. Failure to comply with this Clause shall constitute a material breach of this Agreement and shall entitle the Company to suspend the work, withhold payments, recover losses or damages, or terminate this Agreement in accordance with its terms.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>4. Materials and Storage</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        All materials, fittings, hardware, tools, equipment, and consumables supplied by the Company shall remain the exclusive property of the Company and shall be used solely for the execution of the Services under the applicable Work Order. The Vendor shall verify the quantity and condition of all materials at the time of receipt and immediately report any shortage, damage, or discrepancy to the Company in writing.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall be responsible for the safe custody, proper handling, storage, and protection of all Company-supplied materials and shall take all reasonable precautions to prevent theft, loss, damage, deterioration, misuse, or avoidable wastage. The Vendor shall not remove, transfer, sell, pledge, or use such materials for any purpose other than the Project without the prior written approval of the Company.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        Upon completion or termination of the Services, the Vendor shall return all unused or surplus materials, tools, equipment, and other Company property in good condition, subject to normal wear and tear. The Company shall be entitled to recover the cost of any material lost, damaged, misused, or wasted due to the negligence or default of the Vendor by deduction from payments due to the Vendor or by any other remedy available under the <strong>Indian Contract Act, 1872</strong>, and other applicable laws.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>5. Quality Standards</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall ensure that all Services are executed in a professional and workmanlike manner and strictly in accordance with the approved drawings, specifications, Bill of Quantities (BOQ), approved samples, manufacturer's recommendations, and accepted industry standards. All materials, fittings, hardware, and workmanship shall be of the agreed quality and free from defects, unless otherwise approved in writing by the Company.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Company or its authorized representatives shall have the right to inspect, test, and monitor the quality and progress of the work at any stage of execution. The Vendor shall provide all reasonable assistance required for such inspection and shall promptly comply with any instructions issued by the Company relating to quality, workmanship, or rectification.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        Any work found to be defective, incomplete, non-compliant, or not in accordance with the approved drawings, specifications, or quality standards shall be repaired, replaced, or re-executed by the Vendor at its own cost and risk, without any extension of time or additional payment. If the Vendor fails to rectify such defects within the time specified by the Company, the Company may carry out or engage a third party to carry out the rectification work, and all costs and expenses incurred shall be recoverable from the Vendor.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        Acceptance of the work or release of any payment by the Company shall not relieve the Vendor of its responsibility for maintaining the required quality standards or its obligations under the warranty and defect liability provisions of this Agreement. Any breach of this Clause shall constitute a material breach of the Agreement and entitle the Company to exercise its rights under this Agreement and applicable laws.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>6. TIME SCHEDULE AND DELAYS</h3>
                    <div style={{ margin: '0 0 14px 0', display: 'grid', gap: '8px' }}>
                        <p style={{ margin: 0 }}><strong>6.1 Project Schedule:</strong> The Vendor shall commence the Services immediately upon receipt of the Work Order or such other date as may be specified by the Company and shall complete the assigned work strictly within the commencement, milestone, and completion dates stipulated in the applicable Work Order. Time shall be of the essence in the performance of the Vendor's obligations under this Agreement.</p>
                        <p style={{ margin: 0 }}><strong>6.2 Mobilization:</strong> The Vendor shall promptly mobilize adequate skilled labour, supervisors, tools, machinery, equipment, transportation, and other necessary resources to ensure timely commencement and uninterrupted execution of the Project. Any delay in mobilization without prior written approval of the Company shall constitute a material breach of this Agreement.</p>
                        <p style={{ margin: 0 }}><strong>6.3 Adherence to Project Schedule:</strong> The Vendor shall execute the Services in accordance with the project schedule, construction sequence, and milestone plan communicated by the Company. The Vendor shall coordinate with other contractors, consultants, suppliers, and Company representatives to avoid delays or disruption to the Project.</p>
                        <p style={{ margin: 0 }}><strong>6.4 Progress of Work:</strong> The Vendor shall ensure continuous progress of the work and shall maintain sufficient manpower and resources at the Project Site to meet the agreed completion schedule. Upon request, the Vendor shall submit periodic progress reports, manpower deployment details, and updated completion schedules to the Company.</p>
                        <p style={{ margin: 0 }}><strong>6.5 Delay Attributable to the Vendor:</strong> Where any delay in the execution or completion of the Project is caused by the Vendor, including but not limited to shortage of manpower, inadequate supervision, poor planning, defective workmanship, non-availability of tools or equipment, failure to procure materials (where Vendor supplied), absenteeism, negligence, or any act or omission of the Vendor, the Vendor shall be solely responsible for such delay and all resulting consequences.</p>
                        <p style={{ margin: 0 }}><strong>6.6 Notice of Delay:</strong> If the Vendor anticipates any circumstance that is likely to delay the progress or completion of the Services, the Vendor shall immediately notify the Company in writing, stating the reasons for such delay, the expected duration, and the proposed corrective measures. Such notification shall not relieve the Vendor of its contractual obligations unless the Company grants a written extension of time.</p>
                        <div style={{ margin: 0 }}>
                            <strong>6.7 Extension of Time:</strong> The Company may, at its sole discretion, grant a reasonable extension of the completion period only where the delay is directly attributable to:
                            <ul style={{ margin: '4px 0 4px 20px', padding: 0 }}>
                                <li>Changes in the scope of work instructed by the Company;</li>
                                <li>Delay in handing over the Project Site by the Company;</li>
                                <li>Delay in supply of Company-provided materials;</li>
                                <li>Force Majeure Events as defined under this Agreement; or</li>
                                <li>Any other reason expressly approved by the Company in writing.</li>
                            </ul>
                            No extension shall be deemed granted unless communicated in writing by the Company.
                        </div>
                        <p style={{ margin: 0 }}><strong>6.8 Liquidated Damages:</strong> Without prejudice to any other rights or remedies available under this Agreement or applicable law, if the Vendor fails to complete the Services within the agreed Completion Date, the Company shall be entitled to recover Liquidated Damages at the rate specified in the applicable Work Order, subject to a maximum aggregate amount of <strong>10% of the total Work Order value</strong>, unless otherwise agreed in writing. The Parties acknowledge that such Liquidated Damages represent a genuine pre-estimate of the losses likely to be suffered by the Company due to delayed completion and shall not be construed as a penalty.</p>
                        <p style={{ margin: 0 }}><strong>6.9 Withholding of Payments:</strong> The Company shall have the right to withhold, adjust, deduct, or set off any payment due to the Vendor against any losses, damages, penalties, costs, expenses, or Liquidated Damages arising from delays attributable to the Vendor until the Project is satisfactorily completed.</p>
                        <p style={{ margin: 0 }}><strong>6.10 Recovery of Additional Losses:</strong> Where the actual losses suffered by the Company exceed the amount recoverable as Liquidated Damages, including but not limited to customer compensation, rework costs, third-party contractor charges, project management expenses, or reputational damage resulting from the Vendor's delay, the Company reserves the right to recover such additional losses from the Vendor in accordance with applicable law.</p>
                        <p style={{ margin: 0 }}><strong>6.11 Right to Engage Alternate Vendor:</strong> If the Vendor fails to maintain satisfactory progress or is unlikely to complete the Project within the agreed schedule, the Company may, after giving reasonable notice, engage another contractor or vendor to complete the whole or part of the remaining work. Any additional cost incurred by the Company shall be recoverable from the Vendor without prejudice to the Company's other contractual rights.</p>
                        <p style={{ margin: 0 }}><strong>6.12 Repeated Delays:</strong> Repeated or habitual delays by the Vendor in executing assigned Projects shall constitute a material breach of this Agreement and shall entitle the Company to suspend further Work Orders, remove the Vendor from its approved vendor panel, terminate this Agreement, and recover all consequential losses arising therefrom.</p>
                        <p style={{ margin: 0 }}><strong>6.13 No Waiver:</strong> Any extension of time or temporary waiver granted by the Company in relation to any delay shall not operate as a waiver of the Company's rights in respect of any subsequent delay or breach by the Vendor. This Clause shall be governed by the provisions of the <strong>Indian Contract Act, 1872</strong>, and all rights and remedies available to the Company under this Agreement shall be in addition to, and not in substitution of, any rights available under applicable laws in force in India.</p>
                    </div>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>7. Measurements, Billing and Payments</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The measurements of the completed work shall be jointly verified and recorded by the authorized representatives of the Company and the Vendor in accordance with the approved drawings, specifications, Bill of Quantities (BOQ), and the applicable Work Order. The Company's measurement records shall be final and binding for the purpose of billing unless any discrepancy is reported by the Vendor within <strong>three (3) Business Days</strong> from the date of measurement.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall submit its invoice only upon completion of the applicable milestone or the entire scope of work, as specified in the Work Order. Every invoice shall be accompanied by duly signed measurement sheets, site photographs, completion reports (where applicable), delivery challans, and a valid tax invoice complying with the provisions of the <strong>Central Goods and Services Tax Act, 2017</strong>, the <strong>Integrated Goods and Services Tax Act, 2017</strong>, and other applicable tax laws.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Company shall verify the submitted documents, inspect the completed work, and confirm compliance with the approved quality standards, specifications, and contractual requirements before processing any payment. The Company shall be entitled to reject or withhold any invoice that is incomplete, inaccurate, unsupported by the required documents, or relates to defective or incomplete work until such deficiencies are rectified by the Vendor.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        Payments shall be made only after satisfactory completion and acceptance of the work by the Company and shall be subject to deduction of applicable taxes, including <strong>Tax Deducted at Source (TDS) under the Income-tax Act, 1961</strong>, GST adjustments, statutory recoveries, retention amounts (if applicable), penalties, liquidated damages, or any other amounts recoverable from the Vendor under this Agreement or the applicable Work Order.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        No payment made by the Company shall be deemed to constitute acceptance of defective or incomplete work or operate as a waiver of the Company's right to require rectification, replacement, recovery of damages, or enforcement of any other rights available under this Agreement or applicable law. Any dispute relating to measurements, billing, or payment shall be resolved in accordance with the dispute resolution provisions contained in this Agreement.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>8. Confidentiality and Customer Protection</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor acknowledges that, in the course of performing the Services, it may have access to the Company's confidential and proprietary information, including but not limited to drawings, designs, quotations, pricing, customer details, business processes, technical information, project documents, and other Confidential Information. The Vendor shall keep such information strictly confidential and shall not disclose, copy, use, or share it with any third party except as required for the performance of this Agreement or with the Company's prior written consent.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall use the Confidential Information solely for the purpose of executing the Services under this Agreement and shall take all reasonable steps to protect it from unauthorized access, disclosure, or misuse. Upon completion or termination of the Services, the Vendor shall immediately return or permanently delete all Confidential Information and Company property, if so directed by the Company.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall not, directly or indirectly, contact, solicit, negotiate with, or undertake any work for any Customer introduced by the Company, either during the term of this Agreement or for a period of <strong>twenty-four (24) months</strong> after its termination or expiry, without the Company's prior written consent.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        Any breach of this Clause shall constitute a <strong>material breach</strong> of this Agreement, entitling the Company to terminate this Agreement immediately, withhold pending payments, recover all losses and damages, and seek appropriate legal remedies, including injunctive relief, in accordance with the <strong>Indian Contract Act, 1872</strong>, the <strong>Specific Relief Act, 1963</strong>, and other applicable laws.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>9. Health, Safety and Compliance</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall comply with all applicable labour, health, safety, environmental, and statutory laws, rules, regulations, and government notifications in force in India, including obtaining and maintaining all necessary licenses, registrations, permits, and approvals required for the execution of the Services.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall deploy only competent and adequately trained personnel and shall ensure that all workers strictly comply with the Company's site safety rules and standard operating procedures. The Vendor shall provide and ensure the proper use of appropriate <strong>Personal Protective Equipment (PPE)</strong>, including safety helmets, safety shoes, gloves, goggles, harnesses, and other protective gear, as may be required for the nature of the work.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        The Vendor shall be solely responsible for the health, safety, conduct, and welfare of its employees and shall immediately report any accident, injury, or unsafe condition at the Project Site to the Company. The Vendor shall indemnify and keep the Company harmless against any claims, liabilities, penalties, or losses arising from the Vendor's failure to comply with this Clause or applicable laws.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>10. Indemnity</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Vendor shall indemnify, defend, and keep the Company, its directors, employees, representatives, and Customers fully indemnified and harmless against any and all losses, claims, damages, liabilities, penalties, fines, costs, expenses, injuries, statutory dues, legal proceedings, and reasonable legal expenses arising out of or in connection with the Vendor's negligence, poor workmanship, defective work, delay, breach of this Agreement, violation of applicable laws, labour disputes, misconduct of its personnel, damage to property, or injury or death of any person caused by the acts or omissions of the Vendor.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        The Company shall have the right to recover such losses, damages, costs, or expenses from any amount payable to the Vendor or by any other legal remedy available under the <strong>Indian Contract Act, 1872</strong>, and other applicable laws. The obligations of the Vendor under this Clause shall survive the completion, termination, or expiry of this Agreement.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>11. Termination</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Company may terminate this Agreement, in whole or in part, with immediate effect by written notice to the Vendor, without any liability, if the Vendor commits fraud, misconduct, repeated quality failures, unreasonable delays, unsafe work practices, material breach of this Agreement, confidentiality breaches, customer complaints of a serious nature, insolvency, abandonment of work, or violation of any applicable law, rule, regulation, or statutory requirement.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        Either Party may terminate this Agreement without assigning any reason by giving <strong>thirty (30) days' prior written notice</strong>, provided that such termination shall not affect the completion of ongoing Work Orders unless otherwise directed by the Company.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        Upon termination, the Vendor shall immediately stop using the Company's confidential information, return all Company property, drawings, documents, materials, tools (if any), and cooperate in the orderly handover of the incomplete or completed work. The Company shall be entitled to engage another vendor to complete the remaining work at the risk and cost of the Vendor, where termination is due to the Vendor's default.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        Termination of this Agreement shall be <strong>without prejudice</strong> to any accrued rights, pending payments, recoveries, indemnities, warranties, or other obligations that have arisen prior to the date of termination. The Company shall also be entitled to recover all losses, damages, costs, and expenses arising from the Vendor's default in accordance with the <strong>Indian Contract Act, 1872</strong>, the <strong>Specific Relief Act, 1963</strong>, and other applicable laws in force in India. The provisions relating to confidentiality, warranty, indemnity, dispute resolution, and other clauses intended to survive termination shall continue to remain valid and enforceable notwithstanding the termination or expiry of this Agreement.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>12. Dispute Resolution</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The Parties shall use their best efforts to resolve amicably, through mutual discussions and good faith negotiations, any dispute, difference, claim, or controversy arising out of or in connection with this Agreement, including its interpretation, performance, breach, termination, or validity. If the dispute is not resolved within <strong>thirty (30) days</strong> from the date of written notice of such dispute, either Party may refer the matter to arbitration.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        The dispute shall be finally resolved by a <strong>sole arbitrator</strong> mutually appointed by the Parties. In the event the Parties fail to mutually agree on the appointment of the arbitrator, the appointment shall be made in accordance with the provisions of the <strong>Arbitration and Conciliation Act, 1996</strong>, including any statutory amendments or re-enactments thereof. The <strong>seat and venue of arbitration shall be Visakhapatnam, Andhra Pradesh</strong>, and the arbitration proceedings shall be conducted in the <strong>English language</strong>.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        The arbitral award shall be final and binding upon both Parties. During the pendency of any dispute, the Vendor shall continue to perform its obligations under this Agreement to the extent reasonably practicable, unless otherwise directed by the Company. Nothing contained in this Clause shall prevent either Party from seeking interim or equitable relief from a court of competent jurisdiction in accordance with applicable law.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>13. Governing Law and Jurisdiction</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        This Agreement shall be governed by, construed, and interpreted in accordance with the <strong>laws of the Republic of India</strong>, including the provisions of the <strong>Indian Contract Act, 1872</strong>, the <strong>Arbitration and Conciliation Act, 1996</strong>, and all other applicable laws, rules, and regulations in force from time to time.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        Subject to the provisions relating to arbitration contained in this Agreement, the <strong>courts at Visakhapatnam, Andhra Pradesh</strong>, shall have <strong>exclusive jurisdiction</strong> over all matters arising out of or in connection with this Agreement, including proceedings for interim, conservatory, or injunctive relief, enforcement of arbitral awards, or any other matter for which the jurisdiction of a competent court is required under applicable law.
                    </p>

                    <h3 style={{ color: '#0c1527', fontWeight: 900, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>16. Miscellaneous</h3>
                    <p style={{ margin: '0 0 10px 0' }}>
                        This Agreement constitutes the <strong>entire understanding</strong> between the Parties and supersedes all prior discussions, negotiations, and agreements relating to its subject matter. No amendment, modification, or variation of this Agreement shall be valid unless made in writing and signed by the authorized representatives of both Parties.
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                        No failure or delay by either Party in exercising any right under this Agreement shall constitute a waiver of such right. If any provision of this Agreement is held to be invalid or unenforceable by a court or arbitral tribunal of competent jurisdiction, the remaining provisions shall continue in full force and effect.
                    </p>
                    <p style={{ margin: '0 0 14px 0' }}>
                        This Agreement shall be binding upon and shall enure to the benefit of the Parties, their respective successors, legal representatives, and permitted assigns, in accordance with applicable law.
                    </p>

                    {/* Annexures */}
                    <div style={{ backgroundColor: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '8px', padding: '12px 16px', margin: '14px 0' }}>
                        <div style={{ fontWeight: 900, color: '#0c1527', fontSize: '11px', marginBottom: '4px' }}>Annexure A – Vendor KYC</div>
                        <ul style={{ margin: '0 0 8px 18px', padding: 0, fontSize: '10px' }}>
                            <li>Vendor Name: <strong>{vendorName}</strong></li>
                            <li>Proprietor/Partner Details</li>
                            <li>Address</li>
                            <li>GSTIN / PAN / Aadhaar</li>
                            <li>Bank Details</li>
                            <li>Emergency Contact</li>
                            <li>List of Supervisors and Carpenters</li>
                        </ul>

                        <div style={{ fontWeight: 900, color: '#0c1527', fontSize: '11px', marginBottom: '4px' }}>Annexure B – Work Order Format</div>
                        <ul style={{ margin: '0 0 0 18px', padding: 0, fontSize: '10px' }}>
                            <li>Project Name: <strong>{projectDetails?.project_name || 'Project Site'}</strong></li>
                            <li>Customer Name / Site Address</li>
                            <li>Scope of Work / Start &amp; Completion Dates</li>
                            <li>Payment Milestones &amp; Penalty (if applicable)</li>
                        </ul>
                    </div>

                    {/* Execution Table */}
                    <div style={{ marginTop: '24px', border: '1px solid #0c1527', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ backgroundColor: '#0c1527', color: '#ffffff', fontWeight: 800, padding: '8px 12px', fontSize: '11px' }}>
                            Execution
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ padding: '8px', textAlign: 'left', width: '50%', borderRight: '1px solid #cbd5e1' }}>For LivinCart and Services Pvt. Ltd.</th>
                                    <th style={{ padding: '8px', textAlign: 'left', width: '50%' }}>Vendor ({vendorName})</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '8px', borderRight: '1px solid #cbd5e1' }}>
                                        <div style={{ fontWeight: 700 }}>Authorized Signatory</div>
                                        <img src={liveCartSignature} alt="Authorized Sign" style={{ height: '40px', objectFit: 'contain', margin: '4px 0' }} />
                                        <div>Name: Livincart Representative</div>
                                        <div>Date: {currentDateStr}</div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ fontWeight: 700 }}>Authorized Signatory</div>
                                        <div style={{ height: '40px', display: 'flex', alignItems: 'center', color: '#64748b', fontStyle: 'italic' }}>Signature &amp; Seal</div>
                                        <div>Name: {vendorName} Representative</div>
                                        <div>Date: {currentDateStr}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px', borderRight: '1px solid #cbd5e1' }}>Witness 1: _____________________</td>
                                    <td style={{ padding: '8px' }}>Witness 2: _____________________</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── PRINT-READY SENTINEL — Puppeteer waits for this ── */}
            {ready && (
                <div
                    id="print-ready"
                    style={{ position: 'fixed', bottom: 0, right: 0, width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};

export default PrintVendorQuotaView;
