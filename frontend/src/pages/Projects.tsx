import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import {
    Search,
    Filter,
    Plus,
    Calendar,
    User,
    MapPin,
    Loader2,
    Trash2,
    RotateCcw,
    CheckCircle,
    Layers,
    FileText,
    Package,
    Wrench,
    Award,
    Folder
} from 'lucide-react';

export const PROJECT_STAGES = [
    'Order booked',
    'MMT done',
    'Masking done',
    'SOW done',
    'Quality check done',
    'R2P done',
    'Works contract done',
    'Production in progress',
    'Ready to dispatch',
    'In transit',
    'Delivery done',
    'Installation stage',
    'Final QC',
    'Handover'
];

const normalizeStage = (stage?: string): string => {
    if (!stage || !stage.trim()) return 'Order booked';
    const sNorm = stage.trim().toLowerCase().replace(/_/g, ' ');
    if (sNorm.includes('order') || sNorm.includes('pre ob') || sNorm.includes('booking')) return 'Order booked';
    if (sNorm.includes('mmt')) return 'MMT done';
    if (sNorm.includes('masking')) return 'Masking done';
    if (sNorm.includes('sow')) return 'SOW done';
    if (sNorm.includes('quality check') || sNorm.includes('qc done')) return 'Quality check done';
    if (sNorm.includes('works contract') || sNorm.includes('work contract')) return 'Works contract done';
    if (sNorm.includes('r2p') || sNorm.includes('r2p done')) return 'R2P done';
    if (sNorm.includes('production in') || sNorm.includes('production_in') || sNorm.includes('production started') || sNorm.includes('production_started')) return 'Production in progress';
    if (sNorm.includes('ready to dispatch') || sNorm.includes('ready_to_dispatch')) return 'Ready to dispatch';
    if (sNorm.includes('in transit') || sNorm.includes('intransit') || sNorm.includes('in_transit')) return 'In transit';
    if (sNorm.includes('delivery done') || sNorm.includes('delivery_done') || sNorm.includes('delivered')) return 'Delivery done';
    if (sNorm.includes('installation')) return 'Installation stage';
    if (sNorm.includes('final qc') || sNorm.includes('final_qc')) return 'Final QC';
    if (sNorm.includes('handover') || sNorm.includes('completed') || sNorm.includes('handover_completed')) return 'Handover';
    return 'Order booked';
};

export const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'Order booked':           { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    'MMT done':               { bg: '#fefce8', text: '#a16207', border: '#fef08a' },
    'Masking done':           { bg: '#f3e8ff', text: '#7c3aed', border: '#ddd6fe' },
    'SOW done':               { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
    'Quality check done':     { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
    'Works contract done':    { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
    'R2P done':               { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
    'Production in progress': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    'Ready to dispatch':      { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    'In transit':             { bg: '#cffafe', text: '#0e7490', border: '#a5f3fc' },
    'Delivery done':          { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
    'Installation stage':     { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
    'Final QC':               { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
    'Handover':               { bg: '#d1fae5', text: '#14532d', border: '#6ee7b7' },
    // legacy aliases kept for backward compat
    'Pending 10% Token Advance': { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
    'R2P':                    { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
    'Ready to Dispatch':      { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    'Masking':                { bg: '#f3e8ff', text: '#7c3aed', border: '#ddd6fe' },
};

export const computeProjectAutoStage = (project: any, allTransactions: any[], pmTasks: any[] = []): { 
    stage: string; 
    paidPercent: number; 
    isStage1Complete: boolean;
    isStage2Complete: boolean;
    isStage3Complete: boolean;
    isStage4Complete: boolean;
    isStage5Complete: boolean;
} => {
    const pId = String(project?.project_id || project?.id || '').toLowerCase().trim();
    const pCode = String(project?.project_code || '').toLowerCase().trim();

    const projCredits = (allTransactions || []).filter((t: any) => {
        if (String(t.type || '').toLowerCase() !== 'credit') return false;
        const tPid = String(t.project_id || '').toLowerCase().trim();
        const tPCode = String(t.project_code || '').toLowerCase().trim();
        const tDesc = String(t.description || '').toLowerCase();
        return (pId && tPid === pId) || 
               (pCode && (tPid === pCode || tPCode === pCode || (pCode.length > 2 && tDesc.includes(pCode))));
    });

    const totalPaidFromTx = projCredits.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
    const advancePaidField = Math.max(
        parseFloat(project?.advance_paid as any) || 0,
        parseFloat(project?.advance_received as any) || 0,
        parseFloat(project?.total_paid as any) || 0,
        parseFloat(project?.paid_amount as any) || 0
    );
    
    const totalPaid = Math.max(totalPaidFromTx, advancePaidField);

    const initialBudget = parseFloat(project?.initial_quote_amount as any) || 0;
    const dbTotalBudget = parseFloat(project?.total_budget as any) || parseFloat(project?.budget as any) || 0;
    const projectStageStr = String(project?.project_stage || '').toLowerCase();
    const isPostQcStage = ['r2p done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done',
        'installation stage', 'final qc', 'handover', 'ready_to_dispatch', 'handover_completed', 'in_progress'].includes(projectStageStr);
    const isQcApproved = project?.is_final_quote_approved === 1 || 
                         project?.status === 'qc_approved' || 
                         ['qc_approved', 'approved'].includes(String(project?.qc_status || '').toLowerCase()) ||
                         isPostQcStage;

    // Strict Immutability Rule: Total budget stays strictly fixed to initial quotation
    // until QC issues official approval (is_final_quote_approved = 1 or qc_approved)
    const totalBudget = (isQcApproved && dbTotalBudget > 0)
        ? dbTotalBudget
        : (initialBudget > 0 ? initialBudget : (dbTotalBudget || 0));
    const stage1BaseBudget = initialBudget > 0 ? initialBudget : totalBudget;

    // ── Payment Stage Targets ─────────────────────────────────────────────
    const stage1Target = Math.round(stage1BaseBudget * 0.10); // 10%
    const stage2Target = Math.round(stage1BaseBudget * 0.20); // 20%
    const stage3Target = Math.round(totalBudget * 0.40);       // 40% (Stage 3 = R2P / client ready)
    const stage4Target = Math.round(totalBudget * 0.90);       // 90% (Stage 4 = Ready to dispatch)
    const stage5Target = Math.round(totalBudget * 1.00);       // 100% (Handover)

    // Calculate payment percentage
    let paidPercent = 0;
    if (totalBudget > 0) {
        paidPercent = (totalPaid / totalBudget) * 100;
    } else if (stage1BaseBudget > 0) {
        paidPercent = (totalPaid / stage1BaseBudget) * 100;
    }

    const isStage2PaidExplicit = Boolean(
        project?.stage2_paid === 1 || 
        project?.is_20_percent_paid === 1 || 
        String(project?.payment_status || '').toLowerCase().includes('20%') ||
        (stage1BaseBudget > 0 && totalPaid >= (stage2Target - 1)) ||
        paidPercent >= 19.5 ||
        (pId && localStorage.getItem(`stage2_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage2_paid_${pCode}`) === 'true')
    );

    const hasReachedMaskingOrBeyond = Boolean(
        isStage2PaidExplicit ||
        isQcApproved ||
        project?.is_final_quote_approved === 1 || 
        project?.qc_approved === 1 ||
        ['qc_approved', 'approved'].includes(String(project?.qc_status || '').toLowerCase()) ||
        ['masking done', 'sow done', 'quality check done', 'r2p done', 'works contract done',
         'production in progress', 'ready to dispatch', 'in transit', 'delivery done',
         'installation stage', 'final qc', 'handover'].includes(projectStageStr)
    );

    const isStage2Complete = isStage2PaidExplicit || hasReachedMaskingOrBeyond;

    const isStage1Complete = isStage2Complete || Boolean(
        stage1BaseBudget > 0 ? (totalPaid >= (stage1Target - 1)) : (totalPaid > 0)
    ) || paidPercent >= 9.9 ||
        project?.stage1_paid === 1 ||
        project?.is_10_percent_paid === 1 ||
        (pId && localStorage.getItem(`stage1_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage1_paid_${pCode}`) === 'true');

    // Stage 3 = 40% (client ready, R2P)
    const isStage3Complete = Boolean(
        project?.stage3_paid === 1 ||
        String(project?.payment_status || '').toLowerCase().includes('60%') ||
        (pId && localStorage.getItem(`stage3_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage3_paid_${pCode}`) === 'true') ||
        ['r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(projectStageStr) ||
        (totalBudget > 0 && totalPaid >= (stage3Target - 1) && paidPercent >= 39.5)
    );

    // Stage 4 = 90% (Ready to dispatch)
    const isStage4Complete = Boolean(totalBudget > 0 && (totalPaid >= (stage4Target - 1) && paidPercent >= 89.5));

    // Stage 5 = 100% (Handover)
    const isStage5Complete = Boolean(totalBudget > 0 && isStage4Complete && (totalPaid >= (stage5Target - 1) && paidPercent >= 99.5));

    // ── PM Timeline task helpers ("green" = status is 'done' or 'completed') ──
    const isPmTaskDone = (taskName: string): boolean => {
        if (!pmTasks || pmTasks.length === 0) return false;
        const norm = taskName.toLowerCase();
        return pmTasks.some((t: any) => {
            const tName = String(t.task_name || t.category || t.name || '').toLowerCase();
            const tStatus = String(t.status || '').toLowerCase();
            return (tName.includes(norm) || norm.includes(tName.split(' ')[0])) &&
                   (tStatus === 'done' || tStatus === 'completed' || tStatus === 'completed_late');
        });
    };

    // ── Workflow event flags ──────────────────────────────────────────────
    // Stage 2 → MMT done: Stage 1 paid (10%)
    const isMmtDone = isStage1Complete;

    // Stage 3 → Masking done: Stage 2 paid (20%) or project advanced to masking
    const isMaskingDone = Boolean(
        isStage2Complete ||
        project?.stage2_paid === 1 ||
        project?.is_20_percent_paid === 1 ||
        paidPercent >= 19.5 ||
        hasReachedMaskingOrBeyond
    );

    // Stage 4 → SOW done: Masking done + PM confirmed / accepted in Quality Check
    const isPmApprovalDone = Boolean(
        project?.is_sow_done === 1 ||
        project?.is_sow_done === true ||
        project?.pm_qc_accepted === 1 ||
        project?.pm_qc_accepted === true ||
        project?.pm_status === 'pm_approved' ||
        project?.pm_status === 'pm_accepted' ||
        project?.is_pm_approved === 1 ||
        (Array.isArray((project as any)?.qc_folders) && (project as any).qc_folders.some((f: any) => f.pm_status === 'pm_approved' || f.pm_status === 'pm_accepted')) ||
        ['pm_approved', 'approved', 'qc_approved'].includes(String(project?.qc_status || '').toLowerCase()) ||
        project?.is_final_quote_approved === 1 ||
        ['sow done', 'quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(projectStageStr)
    );
    const isSowDone = isMaskingDone && isPmApprovalDone;

    // Stage 5 → Quality check done: Final QC inspector approved
    const isQcDone = Boolean(
        isQcApproved ||
        project?.is_final_quote_approved === 1 ||
        project?.qc_approved === 1 ||
        ['approved', 'qc_approved'].includes(String(project?.qc_status || '').toLowerCase()) ||
        ['quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(projectStageStr)
    );

    // Stage 6 → R2P done: client ready + Stage 3 paid (40%)
    const isClientReady = Boolean(
        project?.client_ready === 1 ||
        ['client_ready', 'ready'].includes(String(project?.client_status || '').toLowerCase()) ||
        isStage3Complete
    );
    const isR2pDone = isClientReady && isStage3Complete;

    // Stage 7 → Works contract done: agreement PDF done + client accepted (signature or mail acceptance)
    const isWorksContractDone = Boolean(
        (project?.client_signature && String(project?.client_signature || '').length > 10) ||
        project?.works_contract_done === 1 ||
        project?.works_contract_signed === 1 ||
        project?.agreement_accepted === 1 ||
        ['acknowledged', 'signed', 'approved'].includes(String(project?.agreement_status || '').toLowerCase()) ||
        ['works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done',
         'installation stage', 'final qc', 'handover'].includes(projectStageStr)
    );

    // Stage 8 → Production in progress: PM timeline "Product Distribution" task = green
    const isProductionStarted = isPmTaskDone('Product Distribution') || isPmTaskDone('production') ||
        Boolean(project?.production_started === 1) ||
        // fallback: project_stage already at or past this
        ['production in progress', 'ready to dispatch', 'in transit', 'delivery done',
         'installation stage', 'final qc', 'handover'].includes(projectStageStr);

    // Stage 9 → Ready to dispatch: Stage 4 paid (90%)
    const isReadyToDispatch = isStage4Complete;

    // Stage 10 → In transit: PM timeline "In Transit" task = green
    const isInTransit = isPmTaskDone('In Transit') || isPmTaskDone('transit') ||
        Boolean(project?.in_transit === 1) ||
        ['in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(projectStageStr);

    // Stage 11 → Delivery done: PM timeline "Delivery" task = green
    const isDeliveryDone = isPmTaskDone('Delivery') || isPmTaskDone('delivery') ||
        Boolean(project?.delivery_done === 1) ||
        ['delivery done', 'installation stage', 'final qc', 'handover'].includes(projectStageStr);

    // Stage 12 → Installation stage: PM timeline "Installation" task = green
    const isInstallationStarted = isPmTaskDone('Installation') || isPmTaskDone('install') ||
        Boolean(project?.installation_started === 1) ||
        ['installation stage', 'final qc', 'handover'].includes(projectStageStr);

    // Stage 13 → Final QC: PM timeline "Final QC" task = green
    const isFinalQcStarted = isPmTaskDone('Final QC') || isPmTaskDone('final qc') ||
        Boolean(project?.final_qc_done === 1) ||
        ['final qc', 'handover'].includes(projectStageStr);

    // Stage 14 → Handover: 100% paid
    const isHandover = isStage5Complete;

    // ── Stage ladder (highest satisfied wins) ─────────────────────────────
    let stage = 'Order booked';

    if (isHandover) {
        stage = 'Handover';
    } else if (isFinalQcStarted && isStage4Complete) {
        stage = 'Final QC';
    } else if (isInstallationStarted && isStage4Complete) {
        stage = 'Installation stage';
    } else if (isDeliveryDone && isStage4Complete) {
        stage = 'Delivery done';
    } else if (isInTransit && isStage4Complete) {
        stage = 'In transit';
    } else if (isReadyToDispatch) {
        stage = 'Ready to dispatch';
    } else if (isProductionStarted && isWorksContractDone) {
        stage = 'Production in progress';
    } else if (isWorksContractDone && isR2pDone) {
        stage = 'Works contract done';
    } else if (isR2pDone) {
        stage = 'R2P done';
    } else if (isQcDone) {
        stage = 'Quality check done';
    } else if (isSowDone) {
        stage = 'SOW done';
    } else if (isMaskingDone) {
        stage = 'Masking done';
    } else if (isMmtDone) {
        stage = 'MMT done';
    } else {
        stage = 'Order booked';
    }

    return { 
        stage, 
        paidPercent, 
        isStage1Complete,
        isStage2Complete,
        isStage3Complete,
        isStage4Complete,
        isStage5Complete
    };
};

interface Project {
    project_id: string;
    project_code: string;
    project_name: string;
    client_name: string;
    project_type: string;
    site_address: string;
    start_date: string;
    expected_end_date: string;
    project_head_name: string;
    status: string;
    project_stage: string;
    total_budget?: number;
    initial_quote_amount?: number;
    is_final_quote_approved?: number;
}

interface Client {
    client_id: string;
    name: string;
}

interface TeamMember {
    user_id: string;
    name: string;
    role: string;
}

export const isCommonRole = (role?: string) => {
    const r = String(role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return [
        'admin',
        'superadmin',
        'super_admin',
        'manager',
        'management',
        'project_head',
        'general_manager'
    ].includes(r) || r.includes('admin') || r.includes('manager');
};

export const isSiteEngineerRole = (role?: string) => {
    const r = String(role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return [
        'site_engineer',
        'site_inspector',
        'site_inspection',
        'site_manager',
        'engineer',
        'site'
    ].includes(r) || r.includes('site') || r.includes('engineer') || isCommonRole(role);
};

export const isProjectHeadRole = (role?: string) => {
    const r = String(role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return [
        'admin',
        'project_head',
        'project_manager',
        'manager',
        'head'
    ].includes(r) || r.includes('project_head') || r.includes('project_manager') || r.includes('manager') || isCommonRole(role);
};

export const isDesignerRole = (role?: string) => {
    const r = String(role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return [
        'd1',
        'd2',
        'designer',
        'interior_designer',
        'graphic_designer',
        'gd',
        'lead_designer'
    ].includes(r) || r.includes('designer') || r === 'd1' || r === 'd2' || isCommonRole(role);
};

export const isAssociateDesignerRole = (role?: string) => {
    const r = String(role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return [
        'associate_designer',
        'ad',
        'assistant_designer',
        'junior_designer'
    ].includes(r) || r.includes('associate') || r.includes('assistant') || isDesignerRole(role);
};

export const isQcRole = (role?: string) => {
    const r = String(role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return [
        'qc',
        'qc_inspector',
        'quality_check',
        'site_inspector',
        'site_inspection',
        'inspector'
    ].includes(r) || r.includes('qc') || r.includes('inspect') || isCommonRole(role);
};

export const formatRoleDisplay = (role?: string) => {
    if (!role) return '';
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const TeamMultiSelector: React.FC<{
    label: string;
    items: TeamMember[];
    selected: string[];
    onChange: (values: string[]) => void;
    emptyText?: string;
}> = ({ label, items, selected, onChange, emptyText = 'No members available' }) => {
    return (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{label}</label>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: selected.length > 0 ? '#dbeafe' : '#f1f5f9', color: selected.length > 0 ? '#1d4ed8' : '#64748b' }}>
                    {selected.length} selected
                </span>
            </div>

            {/* Quick-select clickable badges */}
            <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '6px 8px',
                minHeight: '65px',
                maxHeight: '105px',
                overflowY: 'auto',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                alignContent: 'flex-start'
            }}>
                {items.map(t => {
                    const isSelected = selected.map(String).includes(String(t.user_id));
                    return (
                        <button
                            type="button"
                            key={t.user_id}
                            onClick={() => {
                                const idStr = String(t.user_id);
                                const next = isSelected
                                    ? selected.filter(id => String(id) !== idStr)
                                    : [...selected, idStr];
                                onChange(next);
                            }}
                            style={{
                                padding: '3px 8px',
                                borderRadius: '14px',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                border: `1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                color: isSelected ? '#1d4ed8' : '#334155',
                                fontWeight: isSelected ? 600 : 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{isSelected ? '✓' : '+'}</span>
                            <span>{t.name}</span>
                            <span style={{ fontSize: '0.68rem', color: isSelected ? '#3b82f6' : '#64748b' }}>
                                ({formatRoleDisplay(t.role)})
                            </span>
                        </button>
                    );
                })}
                {items.length === 0 && (
                    <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '4px 0' }}>{emptyText}</p>
                )}
            </div>

            {/* Standard multi-select dropdown */}
            <select
                multiple
                value={selected.map(String)}
                onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    onChange(values);
                }}
                style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '6px', height: '55px', fontSize: '0.8rem' }}
            >
                {items.map(t => (
                    <option key={t.user_id} value={String(t.user_id)}>
                        {t.name} ({formatRoleDisplay(t.role)})
                    </option>
                ))}
            </select>
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>Click badges or hold Ctrl to select</p>
        </div>
    );
};

import { API_BASE_URL } from '../config';

export const Projects: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = ['admin', 'super_admin', 'superadmin'].includes(String(user?.role || '').toLowerCase().trim()) || Boolean(user?.is_admin);
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const availableHeads = useMemo(() => {
        const heads = team.filter(t => isProjectHeadRole(t.role) || isCommonRole(t.role));
        return heads.length > 0 ? heads : team;
    }, [team]);

    const availableEngineers = useMemo(() => {
        const eng = team.filter(t => isSiteEngineerRole(t.role) || isCommonRole(t.role));
        return eng.length > 0 ? eng : team;
    }, [team]);

    const availableDesigners = useMemo(() => {
        const d = team.filter(t => isDesignerRole(t.role) || isCommonRole(t.role));
        return d.length > 0 ? d : team;
    }, [team]);

    const availableADs = useMemo(() => {
        const ad = team.filter(t => isAssociateDesignerRole(t.role) || isDesignerRole(t.role) || isCommonRole(t.role));
        return ad.length > 0 ? ad : team;
    }, [team]);

    const availableQcs = useMemo(() => {
        const qc = team.filter(t => isQcRole(t.role) || isCommonRole(t.role));
        return qc.length > 0 ? qc : team;
    }, [team]);

    const [formData, setFormData] = useState({
        project_code: '',
        project_name: '',
        client_id: '',
        project_type: 'Furniture projects',
        site_address: '',
        start_date: new Date().toISOString().split('T')[0],
        expected_end_date: '',
        total_budget: '',
        project_head_id: '',
        project_heads: [] as string[],
        site_engineers: [] as string[],
        designers: [] as string[],
        associate_designers: [] as string[],
        qc_inspectors: [] as string[],
        status: 'Pending',
        created_by: user?.user_id || ''
    });

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const reqHeaders = {
                'x-user-id': String(user.user_id),
                'x-user-role': String(user.role)
            };
            const [projectsRes, clientsRes, teamRes, finRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects?user_id=${user.user_id}&role=${user.role}`, { headers: reqHeaders }),
                axios.get(`${API_BASE_URL}/clients`, { headers: reqHeaders }),
                axios.get(`${API_BASE_URL}/users`, { headers: reqHeaders }),
                axios.get(`${API_BASE_URL}/finance`, { headers: reqHeaders }).catch(() => ({ data: { success: false, data: [] } }))
            ]);
            setProjects(projectsRes.data.data || []);
            setClients(clientsRes.data.data || []);
            const userList = Array.isArray(teamRes.data) ? teamRes.data : (teamRes.data?.data || []);
            setTeam(userList);
            const finList = finRes?.data?.data || finRes?.data || [];
            setFinanceTransactions(Array.isArray(finList) ? finList : []);
        } catch (err) {
            console.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleProjectStatusChange = async (projectId: string, newStatus: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        const currentProject = projects.find(p => p.project_id === projectId);
        if (currentProject) {
            const { isStage5Complete, paidPercent } = computeProjectAutoStage(currentProject, financeTransactions);
            const statusNorm = newStatus.toLowerCase().trim();
            if (['completed', 'closed', 'handover', 'handover proposal sent'].includes(statusNorm) && !isStage5Complete) {
                alert(`🔒 Strict Milestone Gate: Project cannot be marked as "${newStatus}" without 100% full payment (Stage 5 milestone). Currently paid: ${paidPercent.toFixed(1)}%.`);
                return;
            }
        }
        try {
            const res = await axios.post(`${API_BASE_URL}/projects/update-status`, {
                project_id: projectId,
                status: newStatus
            });
            if (res.data.success) {
                fetchData();
            } else {
                alert(res.data.message || 'Failed to update project status');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating project status');
        }
    };

    const handleProjectStageChange = async (projectId: string, newStage: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        const currentProject = projects.find(p => p.project_id === projectId);
        if (currentProject) {
            const { isStage4Complete, isStage5Complete, paidPercent } = computeProjectAutoStage(currentProject, financeTransactions);
            const stageNorm = newStage.toLowerCase().trim();
            if (['ready to dispatch', 'dispatch', 'in transit'].includes(stageNorm) && !isStage4Complete) {
                alert(`🔒 Strict Milestone Gate: Cannot change stage to "${newStage}" without 90% cumulative payment (Stage 4 milestone). Currently paid: ${paidPercent.toFixed(1)}%.`);
                return;
            }
            if (stageNorm === 'handover' && !isStage5Complete) {
                alert(`🔒 Strict Milestone Gate: Cannot change stage to Handover without 100% full payment (Stage 5 milestone). Currently paid: ${paidPercent.toFixed(1)}%.`);
                return;
            }

            const currentIdx = PROJECT_STAGES.indexOf(normalizeStage(currentProject.project_stage));
            const newIdx = PROJECT_STAGES.indexOf(normalizeStage(newStage));
            if (currentIdx !== -1 && newIdx !== -1 && newIdx < currentIdx) {
                return; // Disallow reverting to previous stage
            }
        }
        try {
            const res = await axios.post(`${API_BASE_URL}/projects/update-stage`, {
                project_id: projectId,
                stage: newStage
            });
            if (res.data.success) {
                setProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, project_stage: newStage } : p));
            } else {
                alert(res.data.message || 'Failed to update project stage');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating project stage');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.project_heads.length === 0 && !formData.project_head_id) {
            alert('Please select at least one Project Head.');
            return;
        }
        setSubmitting(true);
        try {
            const primaryHead = formData.project_heads[0] || formData.project_head_id || '';
            const response = await axios.post(`${API_BASE_URL}/projects`, {
                ...formData,
                project_head_id: primaryHead,
                total_budget: 0
            });
            if (response.data.success) {
                setShowAddModal(false);
                setFormData({
                    ...formData,
                    project_code: '',
                    project_name: '',
                    client_id: '',
                    site_address: '',
                    total_budget: '',
                    project_head_id: '',
                    project_heads: [],
                    site_engineers: [],
                    designers: [],
                    associate_designers: [],
                    qc_inspectors: []
                });
                fetchData();
            } else {
                alert(response.data.message || 'Failed to create project');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error creating project');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
            try {
                const res = await axios.delete(`${API_BASE_URL}/projects/${id}`);
                if (res.data.success) {
                    fetchData();
                } else {
                    alert(res.data.message || 'Failed to delete project');
                }
            } catch (err) {
                console.error('Delete error', err);
                alert('An error occurred while deleting the project.');
            }
        }
    };

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const autoStageInfo = computeProjectAutoStage(p, financeTransactions);
            
            const pStatusNorm = (p.status || '').trim().toLowerCase();
            if (pStatusNorm === 'cancelled' || pStatusNorm === 'lost' || pStatusNorm === 'dead' || pStatusNorm === 'dropped' || pStatusNorm === 'quotation' || pStatusNorm === 'proposal_accepted' || pStatusNorm === 'meeting_completed' || pStatusNorm === 'in_meeting' || pStatusNorm === 'proposal_sent' || pStatusNorm === 'lead' || pStatusNorm === 'pending') {
                return false;
            }

            // Strict rule: Unconverted leads must NEVER appear in projects page until Stage 1 payment is completed
            if ((p as any).lead_is_converted !== undefined && (p as any).lead_is_converted !== null) {
                if (Number((p as any).lead_is_converted) === 0) {
                    return false;
                }
            }

            const matchesSearch =
                (p.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.project_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.client_name || '').toLowerCase().includes(searchTerm.toLowerCase());

            const pTypeLower = (p.project_type || '').trim().toLowerCase();
            const filterLower = filterType.toLowerCase();
            const matchesFilter = filterType === 'all' ||
                (filterLower === 'commercial project'
                    ? pTypeLower.includes('commercial')
                    : filterLower === 'execution projects'
                        ? (pTypeLower.includes('execution') || pTypeLower.includes('tracker'))
                        : pTypeLower === filterLower);

            const matchesStage = stageFilter === 'all' ||
                autoStageInfo.stage.toLowerCase() === stageFilter.toLowerCase();

            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'approved' && (pStatusNorm === 'approved' || pStatusNorm === 'qc_approved' || p.is_final_quote_approved === 1)) ||
                (statusFilter === 'in progress' && (pStatusNorm === 'in progress' || pStatusNorm === 'on going' || pStatusNorm === 'designing phase' || pStatusNorm === 'qc_approved')) ||
                pStatusNorm === statusFilter.toLowerCase();

            return matchesSearch && matchesFilter && matchesStage && matchesStatus;
        });
    }, [projects, financeTransactions, searchTerm, filterType, stageFilter, statusFilter]);

    return (
        <div className="projects-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527' }}>Projects</h2>
                    <p style={{ color: '#64748b', fontWeight: 500 }}>Manage project allocations and team assignments</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => {
                            setFormData(prev => ({ ...prev, project_code: '' }));
                            setShowAddModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 22px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', backgroundColor: '#0c1527', color: '#ffffff', border: 'none', boxShadow: '0 4px 12px rgba(12, 21, 39, 0.2)' }}
                    >
                        <Plus size={18} color="#fca412" /> Launch New Project
                    </button>
                )}
            </div>

            {/* Stage Metric Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {/* Total Projects Card */}
                <div
                    onClick={() => setStageFilter('all')}
                    style={{
                        backgroundColor: '#ffffff',
                        border: stageFilter === 'all' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Folder size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Projects</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>{projects.length}</div>
                    </div>
                </div>

                {/* Individual Stage Cards */}
                {PROJECT_STAGES.map((stageName) => {
                    const count = projects.filter(p => computeProjectAutoStage(p, financeTransactions).stage === stageName).length;
                    const isSelected = stageFilter.toLowerCase() === stageName.toLowerCase();
                    const cfg = STAGE_COLORS[stageName] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

                    return (
                        <div
                            key={stageName}
                            onClick={() => setStageFilter(isSelected ? 'all' : stageName)}
                            style={{
                                backgroundColor: '#ffffff',
                                border: isSelected ? `2px solid ${cfg.text}` : '1px solid #e2e8f0',
                                borderRadius: '14px',
                                padding: '14px 16px',
                                boxShadow: isSelected ? `0 0 0 3px ${cfg.border}` : '0 1px 3px rgba(0,0,0,0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: cfg.bg, color: cfg.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: '0.9rem' }}>
                                {count}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: cfg.text, textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: 1.2 }}>{stageName}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{count} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>project{count !== 1 ? 's' : ''}</span></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="premium-card">
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Search project name, code or client..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none' }}
                        />
                    </div>

                    <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="all">All Stages</option>
                        {PROJECT_STAGES.map(st => (
                            <option key={st} value={st}>{st}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="in progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>

                    {(searchTerm || filterType !== 'all' || stageFilter !== 'all' || statusFilter !== 'all') && (
                        <button
                            onClick={() => { setSearchTerm(''); setFilterType('all'); setStageFilter('all'); setStatusFilter('all'); }}
                            style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {[
                        { id: 'all', label: 'All Projects' },
                        { id: 'Furniture projects', label: 'Furniture projects' },
                        { id: 'Interior Projects', label: 'Interior Projects' },
                        { id: 'Commercial project', label: 'Commercial project' },
                        { id: 'Execution Projects', label: 'Execution Projects' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterType(tab.id)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                border: '1px solid #e5e7eb',
                                backgroundColor: filterType === tab.id ? '#0c1527' : 'white',
                                color: filterType === tab.id ? 'white' : '#6b7280',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))',
                    gap: '24px'
                }}>
                    {loading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#fca412' }} /></div>
                    ) : filteredProjects.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#6b7280' }}>No projects found matching your criteria.</div>
                    ) : (
                        filteredProjects.map((project) => {
                            const currentStage = normalizeStage(project.project_stage);
                            const currentIdx = PROJECT_STAGES.indexOf(currentStage);

                            return (
                                <div key={project.project_id} className="premium-card"
                                    onClick={() => navigate(`/projects/${project.project_id}`)}
                                    style={{ border: '1px solid #ffe8c2', transition: 'transform 0.2s', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fca412', backgroundColor: '#fff9f0', border: '1px solid #ffe8c2', padding: '4px 10px', borderRadius: '6px', display: 'inline-block', marginBottom: '4px' }}>
                                                PROJECT ID: {project.project_code || `PR_${project.project_id}`}
                                            </span>
                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c1527', marginTop: '4px' }}>{project.project_name}</h3>
                                            <p style={{ fontSize: '0.9rem', color: '#0c1527', fontWeight: 600 }}>Client: {project.client_name}</p>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                {project.project_type && (
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#1e293b',
                                                        color: '#f8fafc',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        {project.project_type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#6b7280', fontSize: '0.9rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <MapPin size={16} /> <span>{project.site_address}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <User size={16} /> <span>Head: {project.project_head_name}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Calendar size={16} /> <span>{new Date(project.start_date).toLocaleDateString()} - {new Date(project.expected_end_date).toLocaleDateString()}</span>
                                        </div>
                                            {/* Stage Badge (Automated with Payments) */}
                                            {(() => {
                                                const { stage: autoStage, paidPercent } = computeProjectAutoStage(project, financeTransactions);
                                                const cfg = STAGE_COLORS[autoStage] || STAGE_COLORS['Order booked'];

                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                                                        <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, minWidth: '42px' }}>Stage:</span>
                                                        <span style={{
                                                            padding: '5px 12px',
                                                            borderRadius: '20px',
                                                            border: `1.5px solid ${cfg.border}`,
                                                            backgroundColor: cfg.bg,
                                                            color: cfg.text,
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                                        }} title={`Auto-computed based on payments: ${paidPercent.toFixed(1)}% paid`}>
                                                            💳 {autoStage} ({paidPercent.toFixed(1)}% Paid)
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                    </div>

                                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button style={{ color: 'black', fontWeight: 600, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>View Details</button>
                                        {(user?.role === 'admin' || user?.role === 'accountant') && (
                                            <button onClick={(e) => handleDelete(project.project_id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {showAddModal && isAdmin && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Launch New Project</h3>
                        <form onSubmit={handleSubmit}>
                            {/* Project ID Input Field */}
                            <div style={{ marginBottom: '20px', backgroundColor: '#f0f4ff', padding: '16px', borderRadius: '10px', border: '1.5px solid #c7d2fe' }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 800, color: '#1e1b4b' }}>
                                    <span>Enter Project ID *</span>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#4338ca', color: '#ffffff', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
                                        Required
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter Project ID (e.g. VM-PW-R-00)"
                                    value={formData.project_code}
                                    onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '2px solid #6366f1', fontSize: '1rem', fontWeight: 800, outline: 'none', background: '#ffffff', color: '#1e1b4b' }}
                                />
                                <p style={{ fontSize: '0.78rem', color: '#4338ca', marginTop: '6px', fontWeight: 600 }}>
                                    💡 Project ID pattern: VM-PW-R-00 (for Furniture, Interior & Site Execution) or VM-JW-2609-00 (for Factory Job).
                                </p>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Name *</label>
                                <input type="text" required value={formData.project_name} onChange={(e) => setFormData({ ...formData, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client</label>
                                    <select required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="">Select a Client</option>
                                        {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                                    <select value={formData.project_type} onChange={(e) => setFormData({ ...formData, project_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Furniture projects">Furniture projects</option>
                                        <option value="Interior Projects">Interior Projects</option>
                                        <option value="Commercial project">Commercial project</option>
                                        <option value="Site Execution Tracker">Site Execution Tracker</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Address</label>
                                <textarea rows={2} required value={formData.site_address} onChange={(e) => setFormData({ ...formData, site_address: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date *</label>
                                <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>

                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.05rem', fontWeight: 700 }}>Team Allocation</h4>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Select multiple members for each department</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    <TeamMultiSelector
                                        label="Project Head(s) *"
                                        items={availableHeads}
                                        selected={formData.project_heads}
                                        onChange={(vals) => setFormData({ ...formData, project_heads: vals, project_head_id: vals[0] || '' })}
                                        emptyText="No project heads found"
                                    />
                                    <TeamMultiSelector
                                        label="Site Engineer(s)"
                                        items={availableEngineers}
                                        selected={formData.site_engineers}
                                        onChange={(vals) => setFormData({ ...formData, site_engineers: vals })}
                                        emptyText="No site engineers found"
                                    />
                                    <TeamMultiSelector
                                        label="Designer(s) (D1 / D2)"
                                        items={availableDesigners}
                                        selected={formData.designers}
                                        onChange={(vals) => setFormData({ ...formData, designers: vals })}
                                        emptyText="No designers found"
                                    />
                                    <TeamMultiSelector
                                        label="Associate Designer(s) (AD)"
                                        items={availableADs}
                                        selected={formData.associate_designers}
                                        onChange={(vals) => setFormData({ ...formData, associate_designers: vals })}
                                        emptyText="No associate designers found"
                                    />
                                    <TeamMultiSelector
                                        label="QC Inspector(s)"
                                        items={availableQcs}
                                        selected={formData.qc_inspectors}
                                        onChange={(vals) => setFormData({ ...formData, qc_inspectors: vals })}
                                        emptyText="No QC inspectors found"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
