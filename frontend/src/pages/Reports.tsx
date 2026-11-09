import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
    TrendingUp, 
    BarChart3, 
    PieChart as PieIcon, 
    Target, 
    Users, 
    Loader2, 
    Briefcase,
    Activity,
    Award,
    TrendingDown,
    Search,
    CheckCircle2,
    Calendar,
    ChevronDown,
    UserCheck,
    Layers,
    Clock,
    RotateCcw,
    AlertCircle,
    Info,
    DollarSign,
    FileText,
    FileCheck,
    ArrowUpRight,
    ArrowDownRight,
    Building,
    Receipt,
    Truck,
    ShieldCheck,
    CheckCircle,
    XCircle,
    Sliders,
    Filter,
    Download,
    User,
    CheckSquare,
    Palette,
    Compass
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

// --- DATA INTERFACES ACROSS ALL 16 MODULES ---
interface Lead {
    lead_id: number;
    client_name: string;
    contact_number?: string;
    email?: string;
    location?: string;
    estimated_budget?: string | number | null;
    project_type?: string;
    lead_source?: string;
    status: string;
    created_by?: number | string;
    assigned_to?: number | string | null;
    d1_assigned_to?: number | string | null;
    d1_booking_time?: string | null;
    created_at: string;
}

interface Project {
    project_id: string | number;
    project_code?: string;
    project_name: string;
    client_id?: string | number;
    status: string;
    project_stage?: string;
    total_budget?: string | number;
    advance_received?: string | number;
    created_at?: string;
    start_date?: string;
    created_by?: string | number;
    project_head_id?: string | number;
    site_engineer_id?: string | number;
}

interface Client {
    client_id: string | number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    created_at?: string;
}

interface Transaction {
    transaction_id: string | number;
    type: 'credit' | 'debit';
    amount: string | number;
    category: string;
    description?: string;
    date?: string;
    transaction_date?: string;
    created_at?: string;
    payment_mode?: string;
    person_name?: string;
    recorded_by?: string | number;
}

interface Quote {
    quote_id: string | number;
    project_id?: string | number;
    quote_number?: string;
    version?: number;
    total_amount?: string | number;
    status?: string;
    save_type?: string;
    is_final_version?: boolean;
    is_qc_approved?: number | boolean;
    created_at?: string;
    created_by?: string | number;
}

interface Agreement {
    id?: string | number;
    agreement_id?: string | number;
    client_name?: string;
    project_name?: string;
    status?: string;
    total_value?: string | number;
    created_at?: string;
    created_by?: string | number;
}

interface Reimbursement {
    id: string | number;
    user_id?: string | number;
    userName?: string;
    user_name?: string;
    amount: string | number;
    category: string;
    reason?: string;
    status: string;
    created_at: string;
    date?: string;
}

interface MBTask {
    id: number;
    user_id: number | string;
    employee_name: string;
    role?: string;
    task_title: string;
    status: string;
    created_at: string;
    start_date?: string;
    end_date?: string;
}

interface UserMember {
    user_id: string | number;
    name: string;
    role: string;
    status?: string;
    email?: string;
    phone?: string;
}

interface Vendor {
    id?: string | number;
    vendor_id?: string | number;
    name?: string;
    vendor_name?: string;
    type?: string;
    category?: string;
    phone?: string;
    created_at?: string;
}

interface VendorQuota {
    id?: string | number;
    quota_id?: string | number;
    vendor_name?: string;
    total_amount?: string | number;
    status?: string;
    created_at?: string;
}

const COLOR_PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
    '#06b6d4', '#f97316', '#64748b', '#84cc16', '#14b8a6',
    '#e11d48', '#6366f1', '#d97706', '#059669', '#0284c7'
];

/**
 * Custom Pie Label Renderer with Connecting Pointer Line Arrows and Dark Percentage Box.
 * User requirement: "pie chanert wiht arrow reoresntaing"
 */
const renderCustomizedPieLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name, fill } = props;
    if (!percent || percent <= 0.01) return null;
    const RADIAN = Math.PI / 180;
    
    // Position for inside percentage badge
    const badgeRadius = innerRadius ? (innerRadius + (outerRadius - innerRadius) * 0.5) : (outerRadius * 0.60);
    const badgeX = cx + badgeRadius * Math.cos(-midAngle * RADIAN);
    const badgeY = cy + badgeRadius * Math.sin(-midAngle * RADIAN);

    // Pointer line points
    const sx = cx + (outerRadius + 4) * Math.cos(-midAngle * RADIAN);
    const sy = cy + (outerRadius + 4) * Math.sin(-midAngle * RADIAN);
    const mx = cx + (outerRadius + 22) * Math.cos(-midAngle * RADIAN);
    const my = cy + (outerRadius + 22) * Math.sin(-midAngle * RADIAN);
    const isRight = Math.cos(-midAngle * RADIAN) >= 0;
    const ex = mx + (isRight ? 18 : -18);
    const ey = my;
    const textAnchor = isRight ? 'start' : 'end';

    const pctVal = (percent * 100).toFixed(0);

    return (
        <g>
            {/* Connecting line */}
            <path
                d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
                stroke={fill || '#475569'}
                strokeWidth={1.5}
                fill="none"
            />
            {/* Arrow/dot at slice border */}
            <circle cx={sx} cy={sy} r={2.5} fill={fill || '#475569'} />
            
            {/* Small arrow marker head at horizontal end */}
            <circle cx={ex} cy={ey} r={2} fill={fill || '#475569'} />

            {/* Inside slice dark percentage box */}
            {percent >= 0.04 && (
                <g transform={`translate(${badgeX}, ${badgeY})`}>
                    <rect
                        x="-17"
                        y="-9"
                        width="34"
                        height="18"
                        rx="5"
                        ry="5"
                        fill="#0f172a"
                        opacity="0.92"
                    />
                    <text
                        x="0"
                        y="1"
                        fill="#ffffff"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="10"
                        fontWeight="900"
                    >
                        {`${pctVal}%`}
                    </text>
                </g>
            )}

            {/* Outside text label pointing to slice */}
            <text
                x={ex + (isRight ? 6 : -6)}
                y={ey}
                fill="#0f172a"
                textAnchor={textAnchor}
                dominantBaseline="central"
                fontSize="11"
                fontWeight="800"
            >
                {name} ({pctVal}%)
            </text>
        </g>
    );
};

// --- GAUGE SPEEDOMETER COMPONENT ---
interface GaugeProps {
    value: number;
    target: number;
    title?: string;
}

const GaugeChart: React.FC<GaugeProps> = ({ value, target }) => {
    const validTarget = target > 0 ? target : 200;
    const pct = Math.min(1, Math.max(0, value / validTarget));
    // -180 deg (left) to 0 deg (right)
    const angle = -180 + pct * 180;
    const remaining = Math.max(0, validTarget - value);

    return (
        <div style={{ textAlign: 'center', position: 'relative', width: '100%', padding: '10px 0' }}>
            <svg viewBox="0 0 240 135" style={{ width: '100%', maxHeight: '135px', overflow: 'visible' }}>
                <defs>
                    <linearGradient id="gaugeArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#fca5a5" />
                        <stop offset="50%" stopColor="#fde047" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>
                {/* Background Track */}
                <path
                    d="M 30 115 A 90 90 0 0 1 210 115"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="20"
                    strokeLinecap="round"
                />
                {/* Value Arc */}
                <path
                    d="M 30 115 A 90 90 0 0 1 210 115"
                    fill="none"
                    stroke="url(#gaugeArcGrad)"
                    strokeWidth="20"
                    strokeDasharray={282.7}
                    strokeDashoffset={282.7 * (1 - pct)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                {/* Pivot Circle */}
                <circle cx="120" cy="115" r="7" fill="#1e293b" />
                {/* Needle */}
                <g transform={`rotate(${angle} 120 115)`}>
                    <line x1="120" y1="115" x2="45" y2="115" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
                    <polygon points="40,115 50,111 50,119" fill="#1e293b" />
                </g>
                {/* Current Value on Top of Arc */}
                <text x="120" y="45" fontSize="13" fontWeight="900" fill="#0f172a" textAnchor="middle">{value}</text>
                {/* Min / Max Labels */}
                <text x="28" y="132" fontSize="10" fontWeight="700" fill="#64748b">0</text>
                <text x="212" y="132" fontSize="10" fontWeight="700" fill="#64748b" textAnchor="end">Target: {validTarget}</text>
            </svg>
            <div style={{ marginTop: '2px', fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
                Remaining - <strong style={{ color: '#0f172a' }}>{remaining}</strong>
            </div>
        </div>
    );
};

// --- EXECUTIVE DASHBOARD OVERVIEW COMPONENT (MATCHING DASHBOARD SCREENSHOTS) ---
interface ExecutiveDashboardProps {
    totalLeadsCount: number;
    totalQuotesCount: number;
    leadsConvertedCount: number;
    moneyReceivedTotal: number;
    formatCurrency: (val: number) => string;
    last4MonthsPerformance: any[];
    leadsSourceData: any[];
    monthly12MonthsData: any[];
    orderStatusBreakdownData: any[];
    ordersByTypeData: any[];
    quotes: Quote[];
    projects: Project[];
    clients: Client[];
    vendors: Vendor[];
    leads: Lead[];
}

const OverviewExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
    totalLeadsCount,
    totalQuotesCount,
    leadsConvertedCount,
    moneyReceivedTotal,
    formatCurrency,
    last4MonthsPerformance,
    leadsSourceData,
    monthly12MonthsData,
    orderStatusBreakdownData,
    ordersByTypeData,
    quotes,
    projects,
    clients,
    vendors,
    leads
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ROW 1: LEAD TARGET GAUGE & REVENUE TARGET BAR (SCREENSHOT 3) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
                
                {/* 1.1 Lead Target - This Month */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            LEAD TARGET - THIS MONTH
                        </h4>
                    </div>
                    <GaugeChart value={totalLeadsCount} target={200} />
                </div>

                {/* 1.2 Revenue Target - This Month */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h4 style={{ margin: '0 0 16px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            REVENUE TARGET - THIS MONTH
                        </h4>
                        <div style={{ marginTop: '25px', position: 'relative' }}>
                            {/* Target Bar Container */}
                            <div style={{ width: '100%', height: '48px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                {/* Achieved Fill */}
                                <div 
                                    style={{ 
                                        width: `${Math.min(100, Math.max(0, (moneyReceivedTotal / 2000000) * 100))}%`, 
                                        height: '100%', 
                                        backgroundColor: '#3b82f6', 
                                        transition: 'width 0.8s ease' 
                                    }} 
                                />
                                {/* Target Marker Line */}
                                <div style={{ position: 'absolute', right: '15%', top: 0, bottom: 0, width: '2px', backgroundColor: '#0f172a', zIndex: 2 }}>
                                    <div style={{ position: 'absolute', top: '10px', right: '6px', fontSize: '0.68rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>
                                        Target - Rs. 20,00,000.00
                                    </div>
                                </div>
                            </div>

                            {/* X-axis scale ticks */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8' }}>
                                <span>0</span>
                                <span>5,00,000</span>
                                <span>10,00,000</span>
                                <span>15,00,000</span>
                                <span>20,00,000</span>
                                <span>25,00,000</span>
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
                                Sum of Amount: <strong style={{ color: '#0f172a' }}>{formatCurrency(moneyReceivedTotal)}</strong>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '14px', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                        <span style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', display: 'inline-block', borderRadius: '2px' }} />
                        <span>Achieved</span>
                    </div>
                </div>

            </div>

            {/* ROW 2: LAST 3 MONTHS PERFORMANCE MONITOR & LEADS BY SOURCE (SCREENSHOT 3) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
                
                {/* 2.1 Last 3 Months Performance Monitor */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            LAST 3 MONTHS PERFORMANCE MONITOR <RotateCcw size={13} color="#94a3b8" />
                        </h4>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}></th>
                                    {last4MonthsPerformance.map((m, idx) => (
                                        <th key={idx} style={{ padding: '10px 8px', textAlign: 'center', color: '#334155', fontWeight: 800 }}>
                                            {m.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #f8fafc', backgroundColor: '#fcfdfe' }}>
                                    <td style={{ padding: '10px 8px', fontWeight: 800, color: '#475569', fontSize: '0.70rem', textTransform: 'uppercase' }}>LEADS CREATED</td>
                                    {last4MonthsPerformance.map((m, idx) => (
                                        <td key={idx} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                                            {m.leadsCreated}
                                        </td>
                                    ))}
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '10px 8px', fontWeight: 800, color: '#475569', fontSize: '0.70rem', textTransform: 'uppercase' }}>DEALS CREATED</td>
                                    {last4MonthsPerformance.map((m, idx) => (
                                        <td key={idx} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                                            {m.dealsCreated}
                                        </td>
                                    ))}
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f8fafc', backgroundColor: '#fcfdfe' }}>
                                    <td style={{ padding: '10px 8px', fontWeight: 800, color: '#475569', fontSize: '0.70rem', textTransform: 'uppercase' }}>DEALS WON</td>
                                    {last4MonthsPerformance.map((m, idx) => (
                                        <td key={idx} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                                            {formatCurrency(m.dealsWonValue)}
                                        </td>
                                    ))}
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '10px 8px', fontWeight: 800, color: '#475569', fontSize: '0.70rem', textTransform: 'uppercase' }}>DEALS LOST</td>
                                    {last4MonthsPerformance.map((m, idx) => (
                                        <td key={idx} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>
                                            {formatCurrency(m.dealsLostValue)}
                                        </td>
                                    ))}
                                </tr>
                                <tr style={{ backgroundColor: '#fcfdfe' }}>
                                    <td style={{ padding: '10px 8px', fontWeight: 800, color: '#475569', fontSize: '0.70rem', textTransform: 'uppercase' }}>NO OF DEALS WON</td>
                                    {last4MonthsPerformance.map((m, idx) => (
                                        <td key={idx} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                                            {m.noOfDealsWon}
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2.2 Leads By Source */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        LEADS BY SOURCE
                    </h4>
                    {leadsSourceData.length === 0 ? (
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            No lead source data available
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={leadsSourceData} margin={{ top: 15, right: 10, left: -20, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={700} tickLine={false} />
                                    <YAxis stroke="#64748b" fontSize={11} fontWeight={700} tickLine={false} />
                                    <Tooltip 
                                        formatter={(val: any) => [`${val} Leads`, 'Record Count']}
                                        contentStyle={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="count" name="Record Count" fill="#ff7a59" radius={[3, 3, 0, 0]} maxBarSize={55}>
                                        {leadsSourceData.map((_entry: any, index: number) => (
                                            <Cell key={`source-${index}`} fill={index === 0 ? '#ff7a59' : index === 1 ? '#fb923c' : index === 2 ? '#f97316' : '#fdba74'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    <div style={{ textAlign: 'center', fontSize: '0.70rem', fontWeight: 700, color: '#94a3b8', marginTop: '2px' }}>
                        Lead Source
                    </div>
                </div>

            </div>

            {/* ROW 3: LEADS FLOW FUNNEL BAR (SCREENSHOT 3) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    LEADS FLOW
                </h4>
                
                {/* Pipeline Strip */}
                <div style={{ display: 'flex', width: '100%', height: '28px', borderRadius: '4px', overflow: 'hidden', fontSize: '0.74rem', fontWeight: 800, color: '#ffffff', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}>
                    {/* Stage 1: Leads Created */}
                    <div style={{ flex: 3.5, backgroundColor: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
                        <span>Leads Created</span>
                        <span>{totalLeadsCount}</span>
                    </div>
                    {/* Stage 2: Deal Converted */}
                    <div style={{ flex: 3.5, backgroundColor: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', color: '#78350f' }}>
                        <span>Deal Converted</span>
                        <span>{totalQuotesCount}</span>
                    </div>
                    {/* Stage 3: Deals Won */}
                    <div style={{ flex: 3.5, backgroundColor: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
                        <span>Deals Won</span>
                        <span>{leadsConvertedCount}</span>
                    </div>
                </div>

                {/* Drop / Conversion rate captions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', padding: '0 4px' }}>
                    <span>↓ {totalLeadsCount} (100%)</span>
                    <span style={{ color: '#0f172a', fontWeight: 800 }}>Overall Drop Rate: {Math.max(0, 100 - (totalLeadsCount > 0 ? Math.round((leadsConvertedCount / totalLeadsCount) * 100) : 0))}%</span>
                    <span style={{ color: '#059669', fontWeight: 800 }}>Conversion Rate: {totalLeadsCount > 0 ? Math.round((leadsConvertedCount / totalLeadsCount) * 100) : 0}%</span>
                </div>
            </div>

            {/* ROW 4: MONTHLY REVENUE SPLINE & ORDER STATUS DONUT (SCREENSHOT 2) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
                
                {/* 4.1 Monthly Revenue (Last 12 Months) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.80rem', fontWeight: 800, color: '#1e293b' }}>
                        Monthly Revenue (Last 12 Months)
                    </h4>
                    <div style={{ width: '100%', height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthly12MonthsData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                <defs>
                                    <linearGradient id="revenueSplineGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f1f5f9" />
                                <XAxis dataKey="label" stroke="#64748b" fontSize={10} fontWeight={700} tickLine={false} />
                                <YAxis 
                                    stroke="#64748b" 
                                    fontSize={10} 
                                    fontWeight={700} 
                                    tickLine={false}
                                    tickFormatter={(val) => val >= 100000 ? `${(val/100000).toFixed(0)}L` : val}
                                />
                                <Tooltip 
                                    formatter={(val: any) => [formatCurrency(Number(val)), 'Revenue']}
                                    contentStyle={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    stroke="#2563eb" 
                                    strokeWidth={2.5} 
                                    fillOpacity={1} 
                                    fill="url(#revenueSplineGrad)"
                                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 1, stroke: '#ffffff' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4.2 Project & Deals Status Breakdown Donut */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.80rem', fontWeight: 800, color: '#1e293b' }}>
                        Project &amp; Deals Status Breakdown
                    </h4>
                    {orderStatusBreakdownData.every(d => d.value === 0) ? (
                        <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            No project or deal records
                        </div>
                    ) : (
                        <>
                            <div style={{ width: '100%', height: '190px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={orderStatusBreakdownData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {orderStatusBreakdownData.map((entry, index) => (
                                                <Cell key={`donut-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(val: any) => [`${val} Records`, 'Count']}
                                            contentStyle={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Legend Strip */}
                            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                                {orderStatusBreakdownData.map(item => (
                                    <span key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '9px', height: '9px', backgroundColor: item.color, borderRadius: '2px', display: 'inline-block' }} />
                                        {item.name} ({item.value})
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>

            </div>

            {/* ROW 5: MONTHLY ORDERS BAR & ORDERS BY TYPE PIE (SCREENSHOT 2) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
                
                {/* 5.1 Monthly Projects (Last 12 Months) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.80rem', fontWeight: 800, color: '#1e293b' }}>
                        Monthly Projects (Last 12 Months)
                    </h4>
                    <div style={{ width: '100%', height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthly12MonthsData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" stroke="#64748b" fontSize={10} fontWeight={700} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} fontWeight={700} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="pending" name="Pending" fill="#eab308" radius={[2, 2, 0, 0]} maxBarSize={12} />
                                <Bar dataKey="inProgress" name="In Progress" fill="#06b6d4" radius={[2, 2, 0, 0]} maxBarSize={12} />
                                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={12} />
                                <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#eab308', display: 'inline-block' }} /> Pending</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#06b6d4', display: 'inline-block' }} /> In Progress</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', display: 'inline-block' }} /> Completed</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', display: 'inline-block' }} /> Cancelled</span>
                    </div>
                </div>

                {/* 5.2 Projects by Scope */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.80rem', fontWeight: 800, color: '#1e293b' }}>
                        Business Volume by Scope
                    </h4>
                    {ordersByTypeData.every(d => d.value === 0) ? (
                        <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            No quotation or project records
                        </div>
                    ) : (
                        <>
                            <div style={{ width: '100%', height: '190px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={ordersByTypeData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={75}
                                            dataKey="value"
                                        >
                                            {ordersByTypeData.map((entry, index) => (
                                                <Cell key={`type-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(val: any) => [`${val} Items`, 'Total Count']}
                                            contentStyle={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginTop: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '9px', height: '9px', backgroundColor: '#2563eb', display: 'inline-block' }} /> CLIENT QUOTATIONS ({ordersByTypeData[0]?.value || 0})
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '9px', height: '9px', backgroundColor: '#10b981', display: 'inline-block' }} /> SITE PROJECTS ({ordersByTypeData[1]?.value || 0})
                                </span>
                            </div>
                        </>
                    )}
                </div>

            </div>

            {/* ROW 6: NEW USERS & PRODUCTS / VENDORS SUMMARY CARDS (SCREENSHOT 1) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                
                {/* 6.1 New Users (Last 6 Months) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.80rem', fontWeight: 800, color: '#1e293b' }}>
                        New Users (Last 6 Months)
                    </h4>
                    <div style={{ width: '100%', height: '170px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthly12MonthsData.slice(-6)} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" stroke="#64748b" fontSize={10} fontWeight={700} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} fontWeight={700} tickLine={false} />
                                <Tooltip 
                                    formatter={(val: any) => [`${val} Clients`, 'New Users']}
                                    contentStyle={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="newUsers" name="New Users" fill="#38bdf8" radius={[2, 2, 0, 0]} maxBarSize={38} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 6.2 Company Portfolio Summary Card */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <Briefcase size={16} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                            Company Portfolio
                        </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Quotations / Estimates</span>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{quotes.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Site Projects</span>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{projects.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Registered Clients</span>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{clients.length}</span>
                        </div>
                    </div>
                </div>

                {/* 6.3 Vendors & Contractors Summary Card */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <Truck size={16} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                            Vendors &amp; Contractors
                        </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Active Suppliers</span>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{vendors.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Material Work Orders</span>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{vendors.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Network Status</span>
                            <span style={{ fontWeight: 800, color: '#16a34a' }}>Active &amp; Verified</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* ROW 7: 3 STATUS TABLES (QUOTATIONS, SITE PROJECTS, VENDOR INVOICES) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                
                {/* 7.1 Quotation Proposals Table */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '5px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <FileText size={13} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>Quotation Proposals</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Draft / In Progress</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#d97706' }}>
                                    {quotes.filter(q => (q.status || '').toLowerCase() === 'draft' || !q.status).length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>QC Under Review</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>
                                    {quotes.filter(q => (q.status || '').toLowerCase().includes('qc')).length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Shared with Client</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                                    {quotes.filter(q => (q.status || '').toLowerCase().includes('sent')).length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Approved / Finalized</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                                    {quotes.filter(q => q.is_final_version || q.is_qc_approved || (q.status || '').toLowerCase() === 'approved').length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Lost / Dropped</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                                    {quotes.filter(q => (q.status || '').toLowerCase().includes('reject') || (q.status || '').toLowerCase().includes('lost')).length}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 4px', fontWeight: 800, color: '#0f172a' }}>Total Quotes</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{quotes.length}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 7.2 Site Projects Table */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '5px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <CheckSquare size={13} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>Site Projects Execution</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Site Survey &amp; Planning</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#d97706' }}>
                                    {projects.filter(p => (p.project_stage || '').toLowerCase().includes('survey') || (p.project_stage || '').toLowerCase().includes('plan')).length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>2D / 3D Design Stage</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>
                                    {projects.filter(p => (p.project_stage || '').toLowerCase().includes('design')).length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Site Work In Progress</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                                    {projects.filter(p => (p.project_stage || '').toLowerCase().includes('site') || (p.project_stage || '').toLowerCase().includes('execution') || (p.status || '').toLowerCase() === 'active').length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Completed / Handover</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                                    {projects.filter(p => (p.status || '').toLowerCase() === 'completed').length}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>On Hold / Cancelled</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                                    {projects.filter(p => (p.status || '').toLowerCase().includes('hold') || (p.status || '').toLowerCase().includes('lost')).length}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 4px', fontWeight: 800, color: '#0f172a' }}>Total Projects</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{projects.length}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 7.3 Site Material Invoices Table */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '5px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
                            <Building size={13} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>Vendor Material Invoices</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Pending PM Approval</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#d97706' }}>0</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Pending Admin Approval</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>0</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Dispatched to Site</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>0</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Approved &amp; Cleared</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>0</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 4px', color: '#64748b' }}>Rejected / Disputed</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>0</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 4px', fontWeight: 800, color: '#0f172a' }}>Total Invoices</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>0</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>

            {/* ROW 8: DAILY DEALS CALL REPORT & TALKTIME (SCREENSHOT 4) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
                
                {/* 8.1 Daily DEALS - Call Report */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.80rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Daily DEALS - Call Report <RotateCcw size={13} color="#94a3b8" />
                        </h4>
                    </div>

                    <div style={{ width: '100%', height: '200px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={[
                                    { stage: 'Initial Quotation', count: quotes.filter(q => Number(q.version || 1) <= 1).length },
                                    { stage: 'Followup', count: leads.filter(l => ['discussion', 'followup', 'meeting_scheduled', 'proposal_sent'].includes((l.status || '').toLowerCase())).length },
                                    { stage: 'Revised Quotation', count: quotes.filter(q => Number(q.version || 1) > 1).length }
                                ]} 
                                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="stage" stroke="#64748b" fontSize={10} fontWeight={700} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} fontWeight={700} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="count" name="Record Count" radius={[2, 2, 0, 0]} maxBarSize={60}>
                                    <Cell fill="#cbd5e1" />
                                    <Cell fill="#fbbf24" />
                                    <Cell fill="#f97316" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.70rem', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>
                        Stage (Calls - Deals)
                    </div>
                </div>

                {/* 8.2 Monthly Activity & Follow-up Log */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.80rem', fontWeight: 800, color: '#1e293b' }}>
                        Monthly Talktime / Activity
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1.5px solid #e5e7eb', color: '#475569', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 6px', fontWeight: 800 }}>Call Start Time</th>
                                    <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800 }}>Record Count</th>
                                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800 }}>Sum Of Call Duration</th>
                                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800 }}>Avg Of Call Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px 8px', color: '#94a3b8', fontWeight: 600 }}>
                                        No call logs or telephony activity recorded
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

        </div>
    );
};

export const Reports: React.FC = () => {
    const { user: currentUser } = useAuth();

    // --- RAW DATA STATES ---
    const [leads, setLeads] = useState<Lead[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [agreements, setAgreements] = useState<Agreement[]>([]);
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [tasks, setTasks] = useState<MBTask[]>([]);
    const [users, setUsers] = useState<UserMember[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorQuotas, setVendorQuotas] = useState<VendorQuota[]>([]);

    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // --- FILTER STATES (DAILY, WEEKLY, MONTHLY, DATE RANGE) ---
    // User requirement: "and filter in in allsame monthn daily and weakily and date range all need in"
    const [timeFilter, setTimeFilter] = useState<'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom' | 'all'>('this_month');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [pieCategory, setPieCategory] = useState<'leads' | 'expenses' | 'projects' | 'tasks' | 'reimbursements'>('leads');
    const [flowChartMetric, setFlowChartMetric] = useState<'finance' | 'leads'>('finance');

    // --- TOP TABS (USER EXPLICIT REQUIREMENT: "i saidin sperte tab in top not btoom") ---
    const [activeTab, setActiveTab] = useState<
        'overview' | 'person_wise' | 'leads' | 'finance' | 'projects' | 'quotes' | 'expenses' | 'reimbursements' | 'vendors' | 'tasks'
    >('overview');

    // --- PERSON-WISE SPECIFIC STATES ---
    const [selectedPersonId, setSelectedPersonId] = useState<string>('');
    const [personRoleCategoryFilter, setPersonRoleCategoryFilter] = useState<string>('all');
    const [personPieType, setPersonPieType] = useState<'leads' | 'tasks' | 'quotes' | 'reimbursements'>('leads');

    // --- FETCH ALL 16 DOMAINS SIMULTANEOUSLY ---
    const fetchAllData = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const [
                leadsRes,
                projectsRes,
                clientsRes,
                financeRes,
                quotesRes,
                agreementsRes,
                reimbursementsRes,
                tasksRes,
                usersRes,
                vendorsRes,
                mainVendorsRes,
                vendorQuotaRes
            ] = await Promise.all([
                axios.get(`${API_BASE_URL}/leads`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/projects`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/clients`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/finance`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/quotes`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/agreements`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/reimbursements`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/mb-tasks`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/users`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/vendors`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/main-vendors`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/vendor-quota`).catch(() => ({ data: { data: [] } }))
            ]);

            const loadedUsers: UserMember[] = Array.isArray(usersRes.data?.data) ? usersRes.data.data : (Array.isArray(usersRes.data) ? usersRes.data : []);
            setUsers(loadedUsers);

            if (loadedUsers.length > 0 && !selectedPersonId) {
                const foundSelf = loadedUsers.find(u => String(u.user_id) === String(currentUser?.user_id));
                setSelectedPersonId(String(foundSelf ? foundSelf.user_id : loadedUsers[0].user_id));
            }

            setLeads(Array.isArray(leadsRes.data?.data) ? leadsRes.data.data : (Array.isArray(leadsRes.data) ? leadsRes.data : []));
            setProjects(Array.isArray(projectsRes.data?.data) ? projectsRes.data.data : (Array.isArray(projectsRes.data) ? projectsRes.data : []));
            setClients(Array.isArray(clientsRes.data?.data) ? clientsRes.data.data : (Array.isArray(clientsRes.data) ? clientsRes.data : []));
            setTransactions(Array.isArray(financeRes.data?.data) ? financeRes.data.data : (Array.isArray(financeRes.data) ? financeRes.data : []));
            setQuotes(Array.isArray(quotesRes.data?.data) ? quotesRes.data.data : (Array.isArray(quotesRes.data) ? quotesRes.data : []));
            setAgreements(Array.isArray(agreementsRes.data?.data) ? agreementsRes.data.data : (Array.isArray(agreementsRes.data) ? agreementsRes.data : []));
            setReimbursements(Array.isArray(reimbursementsRes.data?.data) ? reimbursementsRes.data.data : (Array.isArray(reimbursementsRes.data) ? reimbursementsRes.data : []));
            setTasks(Array.isArray(tasksRes.data?.data) ? tasksRes.data.data : (Array.isArray(tasksRes.data) ? tasksRes.data : []));

            const combinedVendors = [
                ...(Array.isArray(vendorsRes.data?.data) ? vendorsRes.data.data : []),
                ...(Array.isArray(mainVendorsRes.data?.data) ? mainVendorsRes.data.data : [])
            ];
            setVendors(combinedVendors);
            setVendorQuotas(Array.isArray(vendorQuotaRes.data?.data) ? vendorQuotaRes.data.data : (Array.isArray(vendorQuotaRes.data) ? vendorQuotaRes.data : []));
        } catch (err: any) {
            console.error('Error loading report analytics:', err);
            setFetchError(err.message || 'Failed to aggregate report data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // --- UNIVERSAL DATE FILTER (DAILY, WEEKLY, MONTHLY, DATE RANGE) ---
    const isDateInFilter = (dateStr?: string | null): boolean => {
        if (timeFilter === 'all') return true;
        if (!dateStr) return false;

        const recordDate = new Date(dateStr);
        if (isNaN(recordDate.getTime())) return false;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (timeFilter === 'today') {
            return recordDate >= startOfToday && recordDate <= endOfToday;
        }

        if (timeFilter === 'this_week') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return recordDate >= sevenDaysAgo && recordDate <= endOfToday;
        }

        if (timeFilter === 'this_month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return recordDate >= startOfMonth && recordDate <= endOfToday;
        }

        if (timeFilter === 'last_month') {
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            return recordDate >= startOfLastMonth && recordDate <= endOfLastMonth;
        }

        if (timeFilter === 'this_year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return recordDate >= startOfYear && recordDate <= endOfToday;
        }

        if (timeFilter === 'custom') {
            const start = customStartDate ? new Date(customStartDate) : new Date('2020-01-01');
            const end = customEndDate ? new Date(customEndDate + 'T23:59:59') : endOfToday;
            return recordDate >= start && recordDate <= end;
        }

        return true;
    };

    // --- FILTERED DATASETS (OVERALL) ---
    const filteredLeads = useMemo(() => {
        return leads.filter(l => isDateInFilter(l.created_at));
    }, [leads, timeFilter, customStartDate, customEndDate]);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => isDateInFilter(p.created_at || p.start_date));
    }, [projects, timeFilter, customStartDate, customEndDate]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => isDateInFilter(t.date || t.transaction_date || t.created_at));
    }, [transactions, timeFilter, customStartDate, customEndDate]);

    const filteredQuotes = useMemo(() => {
        return quotes.filter(q => isDateInFilter(q.created_at));
    }, [quotes, timeFilter, customStartDate, customEndDate]);

    const filteredAgreements = useMemo(() => {
        return agreements.filter(a => isDateInFilter(a.created_at));
    }, [agreements, timeFilter, customStartDate, customEndDate]);

    const filteredReimbursements = useMemo(() => {
        return reimbursements.filter(r => isDateInFilter(r.date || r.created_at));
    }, [reimbursements, timeFilter, customStartDate, customEndDate]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => isDateInFilter(t.created_at || t.start_date));
    }, [tasks, timeFilter, customStartDate, customEndDate]);

    // --- OVERALL TOTALS ---
    const totalLeadsCount = filteredLeads.length;
    const leadsTodayCount = leads.filter(l => {
        const d = new Date(l.created_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

    const leadsConvertedCount = filteredLeads.filter(l => {
        const s = (l.status || '').toLowerCase();
        return s === 'won' || s === 'proposal_accepted' || s === 'booked' || s === 'project_converted';
    }).length;

    const leadsMeetingsCount = filteredLeads.filter(l => {
        const s = (l.status || '').toLowerCase();
        return s.includes('meeting') || s.includes('d1') || s.includes('visit');
    }).length;

    const moneyReceivedTotal = filteredTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + (parseFloat(String(t.amount)) || 0), 0);

    const moneySpentTotal = filteredTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + (parseFloat(String(t.amount)) || 0), 0);

    const netCashflowBalance = moneyReceivedTotal - moneySpentTotal;

    const totalQuotesCount = filteredQuotes.length;
    const totalQuotedAmount = filteredQuotes.reduce((sum, q) => sum + (parseFloat(String(q.total_amount)) || 0), 0);
    const quotesFinalizedCount = filteredQuotes.filter(q => {
        const s = (q.status || '').toLowerCase();
        return q.is_final_version || q.is_qc_approved || s === 'finalized' || s === 'approved' || s === 'qc_approved';
    }).length;

    const totalAgreementsCount = filteredAgreements.length;
    const agreementsSignedCount = filteredAgreements.filter(a => (a.status || '').toLowerCase() === 'signed').length;

    const totalReimbursementsAmount = filteredReimbursements.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);
    const approvedReimbursementsAmount = filteredReimbursements
        .filter(r => (r.status || '').toLowerCase() === 'approved')
        .reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);

    const totalTasksCount = filteredTasks.length;
    const completedTasksCount = filteredTasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
    const inProgressTasksCount = filteredTasks.filter(t => (t.status || '').toLowerCase() === 'in_progress' || (t.status || '').toLowerCase() === 'ongoing').length;

    const totalProjectsCount = filteredProjects.length;

    // --- PERSON-WISE CALCULATIONS ---
    const activeSelectedPerson = useMemo(() => {
        return users.find(u => String(u.user_id) === String(selectedPersonId)) || users[0] || null;
    }, [users, selectedPersonId]);

    const filteredUsersList = useMemo(() => {
        if (personRoleCategoryFilter === 'all') return users;
        return users.filter(u => {
            const r = (u.role || '').toLowerCase();
            if (personRoleCategoryFilter === 'designer') return r === 'd1' || r === 'd2' || r === 'associate_designer';
            if (personRoleCategoryFilter === 'project_manager') return r === 'project_manager' || r === 'project_head' || r === 'manager';
            if (personRoleCategoryFilter === 'site') return r.includes('site');
            if (personRoleCategoryFilter === 'accountant') return r === 'accountant';
            if (personRoleCategoryFilter === 'sales') return r === 'sales' || r === 'business_associate' || r === 'marketing_analyst';
            return true;
        });
    }, [users, personRoleCategoryFilter]);

    // Data attributed to selected person (inheriting the same active time filter!)
    const personAssignedLeads = useMemo(() => {
        if (!activeSelectedPerson) return [];
        const pid = String(activeSelectedPerson.user_id);
        return filteredLeads.filter(l => 
            String(l.assigned_to) === pid || 
            String(l.d1_assigned_to) === pid || 
            String(l.created_by) === pid
        );
    }, [filteredLeads, activeSelectedPerson]);

    const personAssignedTasks = useMemo(() => {
        if (!activeSelectedPerson) return [];
        const pid = String(activeSelectedPerson.user_id);
        const pName = (activeSelectedPerson.name || '').toLowerCase().trim();
        return filteredTasks.filter(t => 
            String(t.user_id) === pid || 
            (t.employee_name && t.employee_name.toLowerCase().trim() === pName)
        );
    }, [filteredTasks, activeSelectedPerson]);

    const personProjects = useMemo(() => {
        if (!activeSelectedPerson) return [];
        const pid = String(activeSelectedPerson.user_id);
        return filteredProjects.filter(p => 
            String(p.created_by) === pid || 
            String(p.project_head_id) === pid || 
            String(p.site_engineer_id) === pid
        );
    }, [filteredProjects, activeSelectedPerson]);

    const personQuotes = useMemo(() => {
        if (!activeSelectedPerson) return [];
        const pid = String(activeSelectedPerson.user_id);
        return filteredQuotes.filter(q => 
            String(q.created_by) === pid ||
            personProjects.some(p => String(p.project_id) === String(q.project_id))
        );
    }, [filteredQuotes, personProjects, activeSelectedPerson]);

    const personReimbursements = useMemo(() => {
        if (!activeSelectedPerson) return [];
        const pid = String(activeSelectedPerson.user_id);
        const pName = (activeSelectedPerson.name || '').toLowerCase().trim();
        return filteredReimbursements.filter(r => 
            String(r.user_id) === pid || 
            (r.userName && r.userName.toLowerCase().trim() === pName) ||
            (r.user_name && r.user_name.toLowerCase().trim() === pName)
        );
    }, [filteredReimbursements, activeSelectedPerson]);

    // Person Totals
    const personTotalLeads = personAssignedLeads.length;
    const personLeadsWon = personAssignedLeads.filter(l => ['won', 'proposal_accepted', 'booked'].includes((l.status || '').toLowerCase())).length;
    const personMeetingsHeld = personAssignedLeads.filter(l => (l.status || '').toLowerCase().includes('meeting')).length;
    
    const personTotalTasks = personAssignedTasks.length;
    const personTasksCompleted = personAssignedTasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
    const personTasksInProgress = personAssignedTasks.filter(t => (t.status || '').toLowerCase() === 'in_progress' || (t.status || '').toLowerCase() === 'ongoing').length;

    const personTotalQuotes = personQuotes.length;
    const personQuotedAmount = personQuotes.reduce((sum, q) => sum + (parseFloat(String(q.total_amount)) || 0), 0);
    const personQuotesFinalized = personQuotes.filter(q => q.is_final_version || q.is_qc_approved || ['finalized', 'approved', 'qc_approved'].includes((q.status || '').toLowerCase())).length;

    const personTotalClaims = personReimbursements.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);
    const personApprovedClaims = personReimbursements.filter(r => (r.status || '').toLowerCase() === 'approved').reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);

    // Person Pie Chart Data with Arrow Representation
    const personPieChartData = useMemo(() => {
        if (personPieType === 'leads') {
            const groups: Record<string, number> = {};
            personAssignedLeads.forEach(l => {
                const s = (l.status || 'Enquiry').replace(/_/g, ' ');
                const label = s.charAt(0).toUpperCase() + s.slice(1);
                groups[label] = (groups[label] || 0) + 1;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value,
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        if (personPieType === 'tasks') {
            const groups: Record<string, number> = {};
            personAssignedTasks.forEach(t => {
                const s = (t.status || 'Pending').replace(/_/g, ' ');
                const label = s.charAt(0).toUpperCase() + s.slice(1);
                groups[label] = (groups[label] || 0) + 1;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value,
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        if (personPieType === 'quotes') {
            const groups: Record<string, number> = {};
            personQuotes.forEach(q => {
                const s = q.is_final_version || q.is_qc_approved ? 'Final Approved' : (q.status || 'Draft').replace(/_/g, ' ');
                const label = s.charAt(0).toUpperCase() + s.slice(1);
                groups[label] = (groups[label] || 0) + 1;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value,
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        if (personPieType === 'reimbursements') {
            const groups: Record<string, number> = {};
            personReimbursements.forEach(r => {
                const cat = (r.category || 'Other').trim();
                const amt = parseFloat(String(r.amount)) || 0;
                groups[cat] = (groups[cat] || 0) + amt;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value: Math.round(value),
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        return [];
    }, [personPieType, personAssignedLeads, personAssignedTasks, personQuotes, personReimbursements]);

    // Overall Company Pie Chart Data
    const pieChartData = useMemo(() => {
        if (pieCategory === 'leads') {
            const groups: Record<string, number> = {};
            filteredLeads.forEach(l => {
                const s = (l.status || 'Enquiry').replace(/_/g, ' ');
                const label = s.charAt(0).toUpperCase() + s.slice(1);
                groups[label] = (groups[label] || 0) + 1;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value,
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        if (pieCategory === 'expenses') {
            const groups: Record<string, number> = {};
            filteredTransactions
                .filter(t => t.type === 'debit')
                .forEach(t => {
                    const cat = (t.category || 'General Expense').trim();
                    const amt = parseFloat(String(t.amount)) || 0;
                    groups[cat] = (groups[cat] || 0) + amt;
                });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value: Math.round(value),
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        if (pieCategory === 'projects') {
            const groups: Record<string, number> = {};
            filteredProjects.forEach(p => {
                const st = (p.project_stage || p.status || 'Active').replace(/_/g, ' ');
                const label = st.charAt(0).toUpperCase() + st.slice(1);
                groups[label] = (groups[label] || 0) + 1;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value,
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        if (pieCategory === 'tasks') {
            const groups: Record<string, number> = {};
            filteredTasks.forEach(t => {
                const st = (t.status || 'Pending').replace(/_/g, ' ');
                const label = st.charAt(0).toUpperCase() + st.slice(1);
                groups[label] = (groups[label] || 0) + 1;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value,
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        if (pieCategory === 'reimbursements') {
            const groups: Record<string, number> = {};
            filteredReimbursements.forEach(r => {
                const cat = (r.category || 'Other').trim();
                const amt = parseFloat(String(r.amount)) || 0;
                groups[cat] = (groups[cat] || 0) + amt;
            });
            return Object.entries(groups).map(([name, value], i) => ({
                name,
                value: Math.round(value),
                color: COLOR_PALETTE[i % COLOR_PALETTE.length]
            }));
        }

        return [];
    }, [pieCategory, filteredLeads, filteredTransactions, filteredProjects, filteredTasks, filteredReimbursements]);

    // Flow Graph Data
    const flowGraphData = useMemo(() => {
        const map: Record<string, { label: string; received: number; spent: number; leadsIn: number; leadsWon: number }> = {};

        if (flowChartMetric === 'finance') {
            filteredTransactions.forEach(t => {
                const d = t.date || t.transaction_date || t.created_at;
                if (!d) return;
                const dt = new Date(d);
                if (isNaN(dt.getTime())) return;
                const key = timeFilter === 'today' || timeFilter === 'this_week'
                    ? dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                    : dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

                if (!map[key]) {
                    map[key] = { label: key, received: 0, spent: 0, leadsIn: 0, leadsWon: 0 };
                }
                const amt = parseFloat(String(t.amount)) || 0;
                if (t.type === 'credit') map[key].received += amt;
                if (t.type === 'debit') map[key].spent += amt;
            });
        } else {
            filteredLeads.forEach(l => {
                if (!l.created_at) return;
                const dt = new Date(l.created_at);
                if (isNaN(dt.getTime())) return;
                const key = timeFilter === 'today' || timeFilter === 'this_week'
                    ? dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                    : dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

                if (!map[key]) {
                    map[key] = { label: key, received: 0, spent: 0, leadsIn: 0, leadsWon: 0 };
                }
                map[key].leadsIn += 1;
                const s = (l.status || '').toLowerCase();
                if (s === 'won' || s === 'proposal_accepted' || s === 'booked') {
                    map[key].leadsWon += 1;
                }
            });
        }

        const dataArray = Object.values(map);
        return dataArray.length > 0 ? dataArray : [
            { label: 'Current Period', received: moneyReceivedTotal, spent: moneySpentTotal, leadsIn: totalLeadsCount, leadsWon: leadsConvertedCount }
        ];
    }, [flowChartMetric, filteredTransactions, filteredLeads, timeFilter, moneyReceivedTotal, moneySpentTotal, totalLeadsCount, leadsConvertedCount]);

    const formatCurrency = (val: number) => {
        return '₹' + Math.round(val).toLocaleString('en-IN');
    };

    // 12 Months Rolling Revenue & Activity Data
    const monthly12MonthsData = useMemo(() => {
        const months: { key: string; label: string; fullLabel: string; revenue: number; orders: number; pending: number; inProgress: number; completed: number; cancelled: number; newUsers: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-IN', { month: 'short' }) + " '" + String(d.getFullYear()).slice(-2);
            const fullLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            months.push({ key, label, fullLabel, revenue: 0, orders: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0, newUsers: 0 });
        }

        // Transactions Revenue
        transactions.forEach(t => {
            if (t.type !== 'credit') return;
            const dStr = t.date || t.transaction_date || t.created_at;
            if (!dStr) return;
            const dt = new Date(dStr);
            if (isNaN(dt.getTime())) return;
            const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const target = months.find(m => m.key === k);
            if (target) {
                target.revenue += parseFloat(String(t.amount)) || 0;
            }
        });

        // Leads & Projects Activity
        leads.forEach(l => {
            if (!l.created_at) return;
            const dt = new Date(l.created_at);
            if (isNaN(dt.getTime())) return;
            const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const target = months.find(m => m.key === k);
            if (target) {
                target.orders += 1;
                const s = (l.status || '').toLowerCase();
                if (['won', 'completed', 'proposal_accepted'].includes(s)) target.completed += 1;
                else if (['lost', 'cancelled', 'dropped'].includes(s)) target.cancelled += 1;
                else if (['in_progress', 'ongoing', 'meeting_scheduled', 'quote_sent'].includes(s)) target.inProgress += 1;
                else target.pending += 1;
            }
        });

        // Clients
        clients.forEach(c => {
            if (!c.created_at) return;
            const dt = new Date(c.created_at);
            if (isNaN(dt.getTime())) return;
            const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const target = months.find(m => m.key === k);
            if (target) {
                target.newUsers += 1;
            }
        });

        return months;
    }, [transactions, leads, clients]);

    // Last 3-4 Months Comparison Matrix
    const last4MonthsPerformance = useMemo(() => {
        const recent4 = monthly12MonthsData.slice(-4);
        return recent4.map(m => {
            const mQuotes = quotes.filter(q => {
                if (!q.created_at) return false;
                const dt = new Date(q.created_at);
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` === m.key;
            });
            const dealsCreated = mQuotes.length;
            const dealsWonQuotes = mQuotes.filter(q => q.is_final_version || q.is_qc_approved || ['approved', 'won', 'finalized'].includes((q.status || '').toLowerCase()));
            const dealsWonValue = dealsWonQuotes.reduce((sum, q) => sum + (parseFloat(String(q.total_amount)) || 0), 0);
            const dealsLostQuotes = mQuotes.filter(q => ['lost', 'cancelled', 'rejected'].includes((q.status || '').toLowerCase()));
            const dealsLostValue = dealsLostQuotes.reduce((sum, q) => sum + (parseFloat(String(q.total_amount)) || 0), 0);

            return {
                label: m.fullLabel,
                leadsCreated: m.orders,
                dealsCreated: dealsCreated,
                dealsWonValue: dealsWonValue,
                dealsLostValue: dealsLostValue,
                noOfDealsWon: dealsWonQuotes.length
            };
        });
    }, [monthly12MonthsData, quotes]);

    // Leads by Source
    const leadsSourceData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredLeads.forEach(l => {
            let src = (l.lead_source || 'Direct / Walk-in').trim();
            if (src.toLowerCase().includes('meta') || src.toLowerCase().includes('facebook') || src.toLowerCase().includes('fb')) src = 'Meta Ads';
            else if (src.toLowerCase().includes('just')) src = 'Just Dial';
            else if (src.toLowerCase().includes('insta')) src = 'Instagram/FB';
            else if (src.toLowerCase().includes('web') || src.toLowerCase().includes('google')) src = 'Website / Google';
            else if (src.toLowerCase().includes('ref')) src = 'Referral';
            map[src] = (map[src] || 0) + 1;
        });
        const entries = Object.entries(map).map(([name, count]) => ({ name, count }));
        if (entries.length === 0) {
            return [];
        }
        return entries.sort((a, b) => b.count - a.count).slice(0, 6);
    }, [filteredLeads]);

    // Order Status Breakdown Donut
    const orderStatusBreakdownData = useMemo(() => {
        let pending = 0;
        let confirmed = 0;
        let delivered = 0;
        let cancelled = 0;
        let ongoing = 0;

        filteredProjects.forEach(p => {
            const st = (p.status || p.project_stage || '').toLowerCase();
            if (['completed', 'delivered'].includes(st)) delivered += 1;
            else if (['lost', 'cancelled', 'rejected'].includes(st)) cancelled += 1;
            else if (['ongoing', 'site_work', 'execution'].includes(st)) ongoing += 1;
            else if (['in_progress', 'confirmed', 'booked'].includes(st)) confirmed += 1;
            else pending += 1;
        });

        filteredLeads.forEach(l => {
            const st = (l.status || '').toLowerCase();
            if (['won', 'completed'].includes(st)) delivered += 1;
            else if (['lost', 'cancelled', 'dropped'].includes(st)) cancelled += 1;
            else if (['proposal_sent', 'meeting_scheduled', 'in_progress'].includes(st)) confirmed += 1;
            else pending += 1;
        });

        return [
            { name: 'Pending', value: pending, color: '#f59e0b' },
            { name: 'Confirmed', value: confirmed, color: '#06b6d4' },
            { name: 'Delivered', value: delivered, color: '#10b981' },
            { name: 'Cancelled', value: cancelled, color: '#ef4444' },
            { name: 'Ongoing', value: ongoing, color: '#3b82f6' }
        ];
    }, [filteredProjects, filteredLeads]);

    const ordersByTypeData = useMemo(() => {
        const prodCount = quotes.length;
        const servCount = projects.length;
        return [
            { name: 'QUOTATIONS', value: prodCount, color: '#2563eb' },
            { name: 'SITE PROJECTS', value: servCount, color: '#10b981' }
        ];
    }, [quotes, projects]);

    if (loading) {
        return (
            <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: '#f8fafc', minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={40} className="animate-spin" color="#4f46e5" />
                <h3 style={{ margin: '16px 0 6px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Loading Unified Operations Reports...</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Aggregating live data from all 16 business departments</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div style={{ padding: '40px 24px', backgroundColor: '#f8fafc', minHeight: '80vh' }}>
                <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', padding: '24px', borderRadius: '12px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
                    <AlertCircle size={36} color="#dc2626" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{ margin: '0 0 8px', color: '#991b1b', fontWeight: 800 }}>Failed to Load Reports Data</h3>
                    <p style={{ margin: '0 0 16px', color: '#b91c1c', fontSize: '0.85rem' }}>{fetchError}</p>
                    <button
                        onClick={fetchAllData}
                        style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RotateCcw size={16} /> Retry Aggregation
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 28px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'inherit' }}>
            
            {/* ========================================================= */}
            {/* 1. TOP HEADER TITLE & OVERVIEW SUMMARY                    */}
            {/* ========================================================= */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                            Business Intelligence &amp; Operations Reports
                        </h1>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                            Live 360° analytics across all 16 departments: Leads, Finance, Projects, Quotes, Expenses, Vendors &amp; Teams
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setTimeFilter('all');
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setPersonRoleCategoryFilter('all');
                        if (users.length > 0) {
                            setSelectedPersonId(String(users[0].user_id));
                        }
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1.5px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        transition: 'all 0.15s ease'
                    }}
                    title="Clear all filters to All Time"
                >
                    <RotateCcw size={14} /> Clear Filter
                </button>
            </div>

            {/* ========================================================= */}
            {/* 2. UNIVERSAL TOP FILTER BAR (DAILY, WEEKLY, MONTHLY, ETC.) */}
            {/* User requirement: "and filter in in allsame monthn daily and weakily and date range all need in" */}
            {/* ========================================================= */}
            <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={15} color="#4f46e5" /> Period Filter:
                    </span>
                    
                    {/* Time Filter Buttons */}
                    <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '9px', gap: '2px' }}>
                        {(['today', 'this_week', 'this_month', 'last_month', 'this_year', 'custom', 'all'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setTimeFilter(tab)}
                                style={{
                                    padding: '6px 13px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    backgroundColor: timeFilter === tab ? '#4f46e5' : 'transparent',
                                    color: timeFilter === tab ? '#ffffff' : '#475569',
                                    boxShadow: timeFilter === tab ? '0 1px 3px rgba(79,70,229,0.3)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {tab === 'today' ? '📅 Today (Daily)' :
                                 tab === 'this_week' ? '📆 This Week' :
                                 tab === 'this_month' ? '📊 This Month' :
                                 tab === 'last_month' ? '🗓️ Last Month' :
                                 tab === 'this_year' ? '📈 This Year' :
                                 tab === 'custom' ? '⚙️ Custom Date Range' : '🌐 All Time'}
                            </button>
                        ))}
                    </div>

                    {/* Custom Date Pickers */}
                    {timeFilter === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f8fafc', padding: '4px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>From:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={e => setCustomStartDate(e.target.value)}
                                style={{ border: 'none', fontSize: '0.76rem', fontWeight: 700, outline: 'none', backgroundColor: 'transparent' }}
                            />
                            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>To:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={e => setCustomEndDate(e.target.value)}
                                style={{ border: 'none', fontSize: '0.76rem', fontWeight: 700, outline: 'none', backgroundColor: 'transparent' }}
                            />
                        </div>
                    )}
                </div>

                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                    Active View: <strong style={{ color: '#0f172a' }}>{
                        timeFilter === 'today' ? 'Today' :
                        timeFilter === 'this_week' ? 'Past 7 Days' :
                        timeFilter === 'this_month' ? 'Current Month' :
                        timeFilter === 'last_month' ? 'Previous Month' :
                        timeFilter === 'this_year' ? 'Current Year (2026)' :
                        timeFilter === 'custom' ? `${customStartDate || 'Start'} to ${customEndDate || 'Now'}` : 'All Time'
                    }</strong>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 3. TOP NAVIGATION TABS (USER EXPLICIT: "in sperte tab in top not btoom") */}
            {/* ========================================================= */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', padding: '4px', marginBottom: '22px', display: 'flex', overflowX: 'auto', gap: '4px' }}>
                {[
                    { id: 'overview', label: '📊 All Pages Snapshot', badge: '16 Modules' },
                    { id: 'person_wise', label: '👤 Person-Wise Performance Report', badge: activeSelectedPerson ? activeSelectedPerson.name : 'Select Staff' },
                    { id: 'leads', label: '🎯 D1/D2 & Leads', badge: totalLeadsCount },
                    { id: 'finance', label: '💼 Finance & Cashflow', badge: filteredTransactions.length },
                    { id: 'projects', label: '🏗️ Projects & Clients', badge: totalProjectsCount },
                    { id: 'quotes', label: '📜 Quotes & Estimations', badge: totalQuotesCount },
                    { id: 'expenses', label: '🏢 Company Expenses', badge: filteredTransactions.filter(t => t.type === 'debit').length },
                    { id: 'reimbursements', label: '🧾 Staff Reimbursements', badge: filteredReimbursements.length },
                    { id: 'vendors', label: '🔨 Vendors & Quotas', badge: vendors.length },
                    { id: 'tasks', label: '👥 Tasks & Team', badge: totalTasksCount }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '10px 16px',
                            borderRadius: '9px',
                            border: 'none',
                            backgroundColor: activeTab === tab.id ? '#4f46e5' : 'transparent',
                            color: activeTab === tab.id ? '#ffffff' : '#334155',
                            fontWeight: activeTab === tab.id ? 900 : 700,
                            fontSize: '0.80rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span>{tab.label}</span>
                        <span style={{
                            backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                            color: activeTab === tab.id ? '#ffffff' : '#64748b',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.70rem',
                            fontWeight: 800
                        }}>
                            {tab.badge}
                        </span>
                    </button>
                ))}
            </div>

            {/* ========================================================= */}
            {/* 4. TAB VIEW: DEDICATED PERSON-WISE REPORT                 */}
            {/* ========================================================= */}
            {activeTab === 'person_wise' && (
                <div>
                    {/* PERSON SELECTION CONTROLS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px', backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '14px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Filter size={15} color="#4f46e5" />
                                <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155' }}>Filter Role:</span>
                                <select
                                    value={personRoleCategoryFilter}
                                    onChange={e => {
                                        setPersonRoleCategoryFilter(e.target.value);
                                        const subList = users.filter(u => {
                                            const r = (u.role || '').toLowerCase();
                                            if (e.target.value === 'designer') return r === 'd1' || r === 'd2' || r === 'associate_designer';
                                            if (e.target.value === 'project_manager') return r === 'project_manager' || r === 'project_head' || r === 'manager';
                                            if (e.target.value === 'site') return r.includes('site');
                                            if (e.target.value === 'accountant') return r === 'accountant';
                                            if (e.target.value === 'sales') return r === 'sales' || r === 'business_associate' || r === 'marketing_analyst';
                                            return true;
                                        });
                                        if (subList.length > 0) setSelectedPersonId(String(subList[0].user_id));
                                    }}
                                    style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#ffffff', color: '#0f172a', outline: 'none' }}
                                >
                                    <option value="all">All Departments / Roles</option>
                                    <option value="designer">🎨 Designers (D1 / D2 / Associate)</option>
                                    <option value="project_manager">🛡️ Project Managers &amp; Heads</option>
                                    <option value="site">🏗️ Site Engineers &amp; Managers</option>
                                    <option value="accountant">💼 Accountants &amp; Finance</option>
                                    <option value="sales">🎯 Sales &amp; Business Associates</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={15} color="#4f46e5" />
                                <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155' }}>Select Person:</span>
                                <select
                                    value={selectedPersonId}
                                    onChange={e => setSelectedPersonId(e.target.value)}
                                    style={{ padding: '7px 14px', borderRadius: '8px', border: '2px solid #4f46e5', fontSize: '0.82rem', fontWeight: 800, backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', minWidth: '240px' }}
                                >
                                    {filteredUsersList.map(u => (
                                        <option key={u.user_id} value={String(u.user_id)}>
                                            {u.name} — ({u.role.toUpperCase()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Clear Filter Option for Role & Person */}
                            <button
                                onClick={() => {
                                    setPersonRoleCategoryFilter('all');
                                    if (users.length > 0) {
                                        const foundSelf = users.find(u => String(u.user_id) === String(currentUser?.user_id));
                                        setSelectedPersonId(String(foundSelf ? foundSelf.user_id : users[0].user_id));
                                    }
                                    setTimeFilter('all');
                                    setCustomStartDate('');
                                    setCustomEndDate('');
                                }}
                                style={{
                                    padding: '7px 14px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #fecaca',
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontWeight: 800,
                                    fontSize: '0.78rem',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Reset role, person and period filters"
                            >
                                <RotateCcw size={13} /> Clear Filter
                            </button>
                        </div>

                        {activeSelectedPerson && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ backgroundColor: '#e0e7ff', color: '#4338ca', padding: '4px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800 }}>
                                    Role: {activeSelectedPerson.role.toUpperCase()}
                                </span>
                                <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700 }}>
                                    ID: #{activeSelectedPerson.user_id}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* PERSON HERO PERFORMANCE CARDS (WITH BIG BOLD TOTALS) */}
                    {activeSelectedPerson ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                                
                                {/* Card 1: Assigned Leads */}
                                <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                            Assigned Leads
                                        </span>
                                        <Target size={16} color="#2563eb" />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                                            {personTotalLeads}
                                        </span>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#16a34a', backgroundColor: '#ecfdf5', padding: '2px 6px', borderRadius: '4px' }}>
                                            Won: {personLeadsWon}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                        Meetings: <strong>{personMeetingsHeld}</strong> | Rate: <strong>{personTotalLeads > 0 ? Math.round((personLeadsWon/personTotalLeads)*100) : 0}%</strong>
                                    </div>
                                </div>

                                {/* Card 2: Assigned Tasks */}
                                <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                            Assigned Tasks (MB)
                                        </span>
                                        <CheckSquare size={16} color="#059669" />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                                            {personTotalTasks}
                                        </span>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 6px', borderRadius: '4px' }}>
                                            Done: {personTasksCompleted}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                        In Progress: <strong>{personTasksInProgress}</strong> | Pending: <strong>{personTotalTasks - personTasksCompleted - personTasksInProgress}</strong>
                                    </div>
                                </div>

                                {/* Card 3: Quotations Prepared */}
                                <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                            Estimations / Quotes
                                        </span>
                                        <FileText size={16} color="#ea580c" />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                                            {personTotalQuotes}
                                        </span>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ea580c' }}>
                                            {formatCurrency(personQuotedAmount)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                        Final Approved: <strong style={{ color: '#16a34a' }}>{personQuotesFinalized}</strong>
                                    </div>
                                </div>

                                {/* Card 4: Assigned Projects */}
                                <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                            Assigned Projects
                                        </span>
                                        <Briefcase size={16} color="#4f46e5" />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                                            {personProjects.length}
                                        </span>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#4f46e5', backgroundColor: '#eef2ff', padding: '2px 6px', borderRadius: '4px' }}>
                                            Active
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                        Under Design / Execution
                                    </div>
                                </div>

                                {/* Card 5: Reimbursements Claimed */}
                                <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                            Claims &amp; Travel
                                        </span>
                                        <Receipt size={16} color="#ca8a04" />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                                            {personReimbursements.length}
                                        </span>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ca8a04' }}>
                                            {formatCurrency(personTotalClaims)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                        Approved: <strong style={{ color: '#16a34a' }}>{formatCurrency(personApprovedClaims)}</strong>
                                    </div>
                                </div>

                            </div>

                            {/* PERSON-WISE PIE CHART WITH CONNECTING ARROW REPRESENTATION */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                
                                {/* Left Pie: Person's Selected Metric Share */}
                                <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <PieIcon size={18} color="#4f46e5" /> {activeSelectedPerson.name} — Workload Distribution
                                            </h4>
                                            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                                Connected arrow representations with percentage badges
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Metric:</span>
                                            <select
                                                value={personPieType}
                                                onChange={e => setPersonPieType(e.target.value as any)}
                                                style={{ padding: '6px 10px', borderRadius: '7px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 800, outline: 'none' }}
                                            >
                                                <option value="leads">Leads by Status ({personTotalLeads})</option>
                                                <option value="tasks">Tasks by Status ({personTotalTasks})</option>
                                                <option value="quotes">Quotes by Status ({personTotalQuotes})</option>
                                                <option value="reimbursements">Claims ({formatCurrency(personTotalClaims)})</option>
                                            </select>
                                        </div>
                                    </div>

                                    {personPieChartData.length > 0 ? (
                                        <div style={{ width: '100%', height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={personPieChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={55}
                                                        outerRadius={88}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                        label={renderCustomizedPieLabel}
                                                        labelLine={false}
                                                    >
                                                        {personPieChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        formatter={(val: any) => [
                                                            personPieType === 'reimbursements' ? formatCurrency(Number(val)) : val,
                                                            'Total'
                                                        ]}
                                                        contentStyle={{ borderRadius: '8px', fontSize: '0.80rem', fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700 }}>
                                            No entries recorded for this metric under {activeSelectedPerson.name} in this period.
                                        </div>
                                    )}
                                </div>

                                {/* Right Card: Matched Dashboard Panels Summary for this Person */}
                                <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                    <div style={{ marginBottom: '14px' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Compass size={18} color="#059669" /> Assigned Dashboard Sidebar Scope
                                        </h4>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                            Operational breakdown matching this staff member's panel permissions
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {/* Leads Scope */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Target size={15} color="#2563eb" /> D1 / D2 Leads Scope:
                                            </span>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#2563eb' }}>
                                                {personTotalLeads} Leads ({personLeadsWon} Won)
                                            </span>
                                        </div>

                                        {/* Tasks Scope */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <CheckSquare size={15} color="#059669" /> Tasks &amp; Milestones (MB Tasks):
                                            </span>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#059669' }}>
                                                {personTasksCompleted} / {personTotalTasks} Completed
                                            </span>
                                        </div>

                                        {/* Quotes Scope */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <FileText size={15} color="#ea580c" /> Quotes / Estimations Scope:
                                            </span>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ea580c' }}>
                                                {personTotalQuotes} Quotes ({formatCurrency(personQuotedAmount)})
                                            </span>
                                        </div>

                                        {/* Projects Scope */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Briefcase size={15} color="#4f46e5" /> Client Projects Handled:
                                            </span>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4f46e5' }}>
                                                {personProjects.length} Active Projects
                                            </span>
                                        </div>

                                        {/* Reimbursements Scope */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Receipt size={15} color="#ca8a04" /> Field Reimbursements:
                                            </span>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ca8a04' }}>
                                                {personReimbursements.length} Claims ({formatCurrency(personTotalClaims)})
                                            </span>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* PERSON DETAILED ACTIVITY LIST */}
                            <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                                        {activeSelectedPerson.name} — Recent Assigned Work Items
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                                        Deliverables matching selected date period
                                    </span>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#ffffff', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                                <th style={{ padding: '10px 14px' }}>Item Type</th>
                                                <th style={{ padding: '10px 14px' }}>Reference / Title</th>
                                                <th style={{ padding: '10px 14px' }}>Status</th>
                                                <th style={{ padding: '10px 14px' }}>Value / Details</th>
                                                <th style={{ padding: '10px 14px' }}>Created Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Assigned Tasks */}
                                            {personAssignedTasks.slice(0, 6).map(t => (
                                                <tr key={`task-${t.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#059669' }}>📋 MB Task</td>
                                                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{t.task_title}</td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.70rem' }}>
                                                            {t.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', color: '#64748b' }}>Task #{t.id}</td>
                                                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            ))}

                                            {/* Assigned Leads */}
                                            {personAssignedLeads.slice(0, 6).map(l => (
                                                <tr key={`lead-${l.lead_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#2563eb' }}>🎯 D1/D2 Lead</td>
                                                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{l.client_name}</td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.70rem' }}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{l.estimated_budget ? formatCurrency(Number(l.estimated_budget)) : '—'}</td>
                                                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            ))}

                                            {/* Assigned Quotes */}
                                            {personQuotes.slice(0, 6).map(q => (
                                                <tr key={`quote-${q.quote_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#ea580c' }}>📜 Quotation</td>
                                                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{q.quote_number || `Quote #${q.quote_id}`} (v{q.version || 1})</td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.70rem' }}>
                                                            {q.is_final_version || q.is_qc_approved ? 'Approved' : (q.status || 'Draft')}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', fontWeight: 800 }}>{formatCurrency(Number(q.total_amount) || 0)}</td>
                                                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                            Please select an employee above to view their person-wise scorecard.
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================= */}
            {/* 5. TAB VIEW: OVERVIEW (OVERALL COMPANY & DASHBOARDS)      */}
            {/* ========================================================= */}
            {activeTab === 'overview' && (
                <OverviewExecutiveDashboard 
                    totalLeadsCount={totalLeadsCount}
                    totalQuotesCount={totalQuotesCount}
                    leadsConvertedCount={leadsConvertedCount}
                    moneyReceivedTotal={moneyReceivedTotal}
                    formatCurrency={formatCurrency}
                    last4MonthsPerformance={last4MonthsPerformance}
                    leadsSourceData={leadsSourceData}
                    monthly12MonthsData={monthly12MonthsData}
                    orderStatusBreakdownData={orderStatusBreakdownData}
                    ordersByTypeData={ordersByTypeData}
                    quotes={quotes}
                    projects={projects}
                    clients={clients}
                    vendors={vendors}
                    leads={leads}
                />
            )}

            {/* 6. TAB VIEW: DEPARTMENT BREAKDOWNS (LEADS, FINANCE, ETC.) */}
            {/* ========================================================= */}
            {activeTab !== 'overview' && activeTab !== 'person_wise' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    
                    {/* LEADS TAB */}
                    {activeTab === 'leads' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                        Leads Management &amp; D1/D2 Conversions
                                    </h3>
                                    <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                        Total Leads: <strong style={{ color: '#0f172a' }}>{totalLeadsCount}</strong> | Won: <strong style={{ color: '#16a34a' }}>{leadsConvertedCount}</strong> | Rate: <strong style={{ color: '#2563eb' }}>{totalLeadsCount > 0 ? Math.round((leadsConvertedCount/totalLeadsCount)*100) : 0}%</strong>
                                    </p>
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                            <th style={{ padding: '10px 14px' }}>Lead ID</th>
                                            <th style={{ padding: '10px 14px' }}>Client Name</th>
                                            <th style={{ padding: '10px 14px' }}>Project Type</th>
                                            <th style={{ padding: '10px 14px' }}>Budget</th>
                                            <th style={{ padding: '10px 14px' }}>Status</th>
                                            <th style={{ padding: '10px 14px' }}>Source</th>
                                            <th style={{ padding: '10px 14px' }}>Date Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLeads.slice(0, 20).map(l => (
                                            <tr key={l.lead_id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>#{l.lead_id}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>{l.client_name || 'Anonymous'}</td>
                                                <td style={{ padding: '10px 14px' }}>{l.project_type || 'Residential'}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{l.estimated_budget ? formatCurrency(Number(l.estimated_budget)) : '—'}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{
                                                        backgroundColor: l.status === 'won' ? '#ecfdf5' : '#eff6ff',
                                                        color: l.status === 'won' ? '#059669' : '#2563eb',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 800,
                                                        fontSize: '0.72rem'
                                                    }}>
                                                        {l.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{l.lead_source || 'Direct'}</td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* FINANCE TAB */}
                    {activeTab === 'finance' && (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                    Financial Transactions &amp; Ledger
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Inflow: <strong style={{ color: '#059669' }}>{formatCurrency(moneyReceivedTotal)}</strong> | Outflow: <strong style={{ color: '#dc2626' }}>{formatCurrency(moneySpentTotal)}</strong> | Net Balance: <strong style={{ color: '#0f172a' }}>{formatCurrency(netCashflowBalance)}</strong>
                                </p>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                            <th style={{ padding: '10px 14px' }}>Txn ID</th>
                                            <th style={{ padding: '10px 14px' }}>Type</th>
                                            <th style={{ padding: '10px 14px' }}>Category</th>
                                            <th style={{ padding: '10px 14px' }}>Amount</th>
                                            <th style={{ padding: '10px 14px' }}>Person / Entity</th>
                                            <th style={{ padding: '10px 14px' }}>Mode</th>
                                            <th style={{ padding: '10px 14px' }}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.slice(0, 20).map(t => (
                                            <tr key={t.transaction_id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>#{t.transaction_id}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{
                                                        backgroundColor: t.type === 'credit' ? '#ecfdf5' : '#fef2f2',
                                                        color: t.type === 'credit' ? '#059669' : '#dc2626',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 800,
                                                        fontSize: '0.72rem'
                                                    }}>
                                                        {t.type === 'credit' ? 'Received (Credit)' : 'Spent (Debit)'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>{t.category}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 900, color: t.type === 'credit' ? '#059669' : '#dc2626' }}>
                                                    {formatCurrency(parseFloat(String(t.amount)) || 0)}
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>{t.person_name || '—'}</td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.payment_mode || 'Bank'}</td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.date || t.transaction_date || (t.created_at ? new Date(t.created_at).toLocaleDateString() : '—')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* PROJECTS TAB */}
                    {activeTab === 'projects' && (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                    Projects &amp; Client Engagements
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Total Projects: <strong style={{ color: '#0f172a' }}>{totalProjectsCount}</strong> | Total Clients: <strong style={{ color: '#4f46e5' }}>{clients.length}</strong>
                                </p>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                            <th style={{ padding: '10px 14px' }}>Code</th>
                                            <th style={{ padding: '10px 14px' }}>Project Name</th>
                                            <th style={{ padding: '10px 14px' }}>Stage</th>
                                            <th style={{ padding: '10px 14px' }}>Budget</th>
                                            <th style={{ padding: '10px 14px' }}>Advance Paid</th>
                                            <th style={{ padding: '10px 14px' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProjects.slice(0, 20).map(p => (
                                            <tr key={p.project_id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 800, color: '#4f46e5' }}>{p.project_code || `#${p.project_id}`}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>{p.project_name}</td>
                                                <td style={{ padding: '10px 14px' }}>{p.project_stage || 'In Design'}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>{p.total_budget ? formatCurrency(Number(p.total_budget)) : '—'}</td>
                                                <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 700 }}>{p.advance_received ? formatCurrency(Number(p.advance_received)) : '₹0'}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.72rem' }}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* QUOTES TAB */}
                    {activeTab === 'quotes' && (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                    Estimations &amp; Legal Agreements
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Total Quotes: <strong style={{ color: '#0f172a' }}>{totalQuotesCount}</strong> ({formatCurrency(totalQuotedAmount)}) | Finalized: <strong style={{ color: '#16a34a' }}>{quotesFinalizedCount}</strong> | Signed Agreements: <strong style={{ color: '#4f46e5' }}>{agreementsSignedCount}</strong>
                                </p>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                            <th style={{ padding: '10px 14px' }}>Quote #</th>
                                            <th style={{ padding: '10px 14px' }}>Version</th>
                                            <th style={{ padding: '10px 14px' }}>Total Amount</th>
                                            <th style={{ padding: '10px 14px' }}>Status</th>
                                            <th style={{ padding: '10px 14px' }}>Final / QC Approved</th>
                                            <th style={{ padding: '10px 14px' }}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredQuotes.slice(0, 20).map(q => (
                                            <tr key={q.quote_id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 800, color: '#ea580c' }}>{q.quote_number || `#${q.quote_id}`}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>v{q.version || 1}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 900 }}>{formatCurrency(Number(q.total_amount) || 0)}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.72rem' }}>
                                                        {q.status || 'Draft'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    {q.is_final_version || q.is_qc_approved ? (
                                                        <span style={{ color: '#059669', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <CheckCircle2 size={13} /> Final Approved
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontWeight: 700 }}>In Review</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* EXPENSES TAB */}
                    {activeTab === 'expenses' && (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                    Company Overheads &amp; Operational Expenses
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Total Spent: <strong style={{ color: '#dc2626' }}>{formatCurrency(moneySpentTotal)}</strong>
                                </p>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                            <th style={{ padding: '10px 14px' }}>Category</th>
                                            <th style={{ padding: '10px 14px' }}>Amount</th>
                                            <th style={{ padding: '10px 14px' }}>Payee / Person</th>
                                            <th style={{ padding: '10px 14px' }}>Description</th>
                                            <th style={{ padding: '10px 14px' }}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.filter(t => t.type === 'debit').slice(0, 20).map(t => (
                                            <tr key={t.transaction_id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>{t.category}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 900, color: '#dc2626' }}>{formatCurrency(parseFloat(String(t.amount)) || 0)}</td>
                                                <td style={{ padding: '10px 14px' }}>{t.person_name || 'Company'}</td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.description || '—'}</td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.date || t.transaction_date || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* REIMBURSEMENTS TAB */}
                    {activeTab === 'reimbursements' && (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                    Staff &amp; Field Reimbursement Claims
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Total Claimed: <strong style={{ color: '#0f172a' }}>{formatCurrency(totalReimbursementsAmount)}</strong> | Approved: <strong style={{ color: '#16a34a' }}>{formatCurrency(approvedReimbursementsAmount)}</strong>
                                </p>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                            <th style={{ padding: '10px 14px' }}>Claim ID</th>
                                            <th style={{ padding: '10px 14px' }}>Staff Member</th>
                                            <th style={{ padding: '10px 14px' }}>Category</th>
                                            <th style={{ padding: '10px 14px' }}>Amount</th>
                                            <th style={{ padding: '10px 14px' }}>Status</th>
                                            <th style={{ padding: '10px 14px' }}>Reason</th>
                                            <th style={{ padding: '10px 14px' }}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredReimbursements.slice(0, 20).map(r => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>#{r.id}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>{r.userName || r.user_name || 'Staff'}</td>
                                                <td style={{ padding: '10px 14px' }}>{r.category}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 900 }}>{formatCurrency(parseFloat(String(r.amount)) || 0)}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{
                                                        backgroundColor: r.status === 'approved' ? '#ecfdf5' : r.status === 'rejected' ? '#fef2f2' : '#fffbeb',
                                                        color: r.status === 'approved' ? '#059669' : r.status === 'rejected' ? '#dc2626' : '#d97706',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 800,
                                                        fontSize: '0.72rem'
                                                    }}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.reason || '—'}</td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* VENDORS TAB */}
                    {activeTab === 'vendors' && (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                    Vendors, Contractors &amp; Vendor Quotas
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Total Registered Vendors: <strong style={{ color: '#0f172a' }}>{vendors.length}</strong> | Total Vendor Quotas Issued: <strong style={{ color: '#4f46e5' }}>{vendorQuotas.length}</strong>
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                                {vendors.slice(0, 16).map((v, idx) => (
                                    <div key={v.id || v.vendor_id || idx} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '14px', backgroundColor: '#f8fafc' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <Truck size={16} color="#0284c7" />
                                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{v.name || v.vendor_name || 'Vendor'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Type: <strong>{v.category || v.type || 'Supplier'}</strong></span>
                                            <span>{v.phone || 'Verified'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TASKS TAB */}
                    {activeTab === 'tasks' && (
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                    Employee Management &amp; Workload
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Total Tasks: <strong style={{ color: '#0f172a' }}>{totalTasksCount}</strong> | Completed: <strong style={{ color: '#16a34a' }}>{completedTasksCount}</strong> | Active Team Members: <strong style={{ color: '#4f46e5' }}>{users.length}</strong>
                                </p>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 800 }}>
                                            <th style={{ padding: '10px 14px' }}>Task ID</th>
                                            <th style={{ padding: '10px 14px' }}>Employee</th>
                                            <th style={{ padding: '10px 14px' }}>Role</th>
                                            <th style={{ padding: '10px 14px' }}>Task Title</th>
                                            <th style={{ padding: '10px 14px' }}>Status</th>
                                            <th style={{ padding: '10px 14px' }}>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTasks.slice(0, 20).map(t => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>#{t.id}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>{t.employee_name || 'Staff'}</td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.role || 'Team'}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{t.task_title}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{
                                                        backgroundColor: t.status === 'completed' ? '#ecfdf5' : '#eff6ff',
                                                        color: t.status === 'completed' ? '#059669' : '#2563eb',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 800,
                                                        fontSize: '0.72rem'
                                                    }}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            )}

        </div>
    );
};

export default Reports;
