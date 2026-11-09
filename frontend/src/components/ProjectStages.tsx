import React from 'react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { STAGE_COLORS } from '../pages/Projects';

interface ProjectStagesProps {
    paymentProgress: number;
    totalBudget?: number;
    initialBudget?: number;
    totalPaid?: number;
    currentStage?: string;
    isStage1Completed?: boolean;
    isStage2Completed?: boolean;
    isStage3Completed?: boolean;
    isPmAcceptedInQc?: boolean;
    isQcApproved?: boolean;
    // legacy – kept so callers don't break
    stages?: any[];
}

export const ProjectStages: React.FC<ProjectStagesProps> = ({
    paymentProgress = 0,
    totalBudget = 0,
    initialBudget = 0,
    totalPaid,
    currentStage,
    isStage1Completed = false,
    isStage2Completed = false,
    isStage3Completed = false,
    isPmAcceptedInQc = false,
    isQcApproved = false,
}) => {
    const pct = paymentProgress || 0;
    const effectiveBase = totalBudget > 0 ? totalBudget : (initialBudget || 0);
    const effectiveTotalPaid = totalPaid !== undefined 
        ? totalPaid 
        : (effectiveBase > 0 ? Math.round(effectiveBase * (pct / 100)) : 0);

    // 5 Milestones / Project Stages as requested
    const milestones = [
        {
            id: 1,
            name: 'Designer Timeline',
            label: 'Timeline Start (10%)',
            stagePercent: 10,
            cumulativePercent: 10,
            isCompleted: Boolean(isStage1Completed || isStage2Completed || (effectiveBase > 0 ? effectiveTotalPaid >= (Math.round(effectiveBase * 0.10) - 1) : pct >= 9.9))
        },
        {
            id: 2,
            name: 'Masking Stage',
            label: 'Masking Works (20%)',
            stagePercent: 10,
            cumulativePercent: 20,
            isCompleted: Boolean(isStage2Completed || (effectiveBase > 0 ? effectiveTotalPaid >= (Math.round(effectiveBase * 0.20) - 1) : pct >= 19.5))
        },
        {
            id: 3,
            name: 'R2P & Product Distribution',
            label: 'Production / Distribution (40% Stage)',
            stagePercent: 40,
            cumulativePercent: 60,
            isCompleted: Boolean(isStage3Completed || (effectiveBase > 0 ? effectiveTotalPaid >= (Math.round(effectiveBase * 0.60) - 1) : pct >= 59.5))
        },
        {
            id: 4,
            name: 'Ready to Dispatch',
            label: 'Material Dispatch (95% Cumulative / 35% Stage Amount)',
            stagePercent: 35,
            cumulativePercent: 95,
            isCompleted: Boolean(effectiveBase > 0 ? effectiveTotalPaid >= (Math.round(effectiveBase * 0.95) - 1) : pct >= 94.5)
        },
        {
            id: 5,
            name: 'Project Handover',
            label: 'Final Handover (100%)',
            stagePercent: 5,
            cumulativePercent: 100,
            isCompleted: Boolean(effectiveBase > 0 ? effectiveTotalPaid >= (Math.round(effectiveBase * 1.00) - 1) : pct >= 99.5)
        }
    ];

    const activeStageIndex = milestones.findIndex(m => !m.isCompleted);
    const currentMilestoneIdx = activeStageIndex === -1 ? milestones.length - 1 : activeStageIndex;

    const displayCurrentStage = currentStage || (
        milestones[4].isCompleted ? 'Handover' :
        milestones[3].isCompleted ? 'Ready to dispatch' :
        milestones[2].isCompleted ? 'Production in progress' :
        isQcApproved ? 'Quality check done' :
        isPmAcceptedInQc ? 'SOW done' :
        milestones[1].isCompleted ? 'Masking done' :
        milestones[0].isCompleted ? 'MMT done' :
        'Order booked'
    );

    const activeColor = STAGE_COLORS[displayCurrentStage] || STAGE_COLORS['Order booked'] || { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };

    return (
        <div className="premium-card" style={{ padding: '24px' }}>
            {/* Header: Project Stages */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0c1527', letterSpacing: '-0.3px' }}>
                        Project Stages
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                        {effectiveBase > 0 && (
                            <>
                                Budget: <span style={{ color: '#059669', fontWeight: 700 }}>
                                    ₹{effectiveBase.toLocaleString('en-IN')}
                                </span>
                                &nbsp;·&nbsp;
                            </>
                        )}
                        <span style={{ color: '#2563eb', fontWeight: 700 }}>
                            Paid: ₹{Math.round(effectiveTotalPaid).toLocaleString('en-IN')} ({pct.toFixed(1)}% paid)
                        </span>
                    </p>
                </div>

                {/* Active Stage Badge */}
                <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    backgroundColor: activeColor.bg,
                    color: activeColor.text,
                    border: `1.5px solid ${activeColor.border}`,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                    💳 Stage: {displayCurrentStage} ({pct.toFixed(1)}% Paid)
                </span>
            </div>

            {/* Vertical Milestones Stepper */}
            <div style={{ position: 'relative' }}>
                {/* Connector line */}
                <div style={{
                    position: 'absolute',
                    left: '18px',
                    top: '20px',
                    bottom: '20px',
                    width: '2px',
                    backgroundColor: '#e2e8f0',
                    zIndex: 0
                }} />

                {milestones.map((m, idx) => {
                    const isActive = idx === currentMilestoneIdx;
                    const stageAmt = effectiveBase > 0 ? Math.round(effectiveBase * (m.stagePercent / 100)) : 0;
                    const cumTarget = effectiveBase > 0 ? Math.round(effectiveBase * (m.cumulativePercent / 100)) : 0;

                    return (
                        <React.Fragment key={m.id}>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '16px',
                                    position: 'relative',
                                    zIndex: 1,
                                    marginBottom: idx < milestones.length - 1 ? '16px' : '0',
                                    opacity: m.isCompleted || isActive ? 1 : 0.6,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {/* Circle Icon */}
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: m.isCompleted ? '#ecfdf5' : (isActive ? '#eff6ff' : '#f8fafc'),
                                    border: m.isCompleted 
                                        ? '2.5px solid #10b981' 
                                        : (isActive ? '2.5px solid #3b82f6' : '2px solid #cbd5e1'),
                                    boxShadow: isActive ? '0 0 0 4px #dbeafe' : 'none',
                                    position: 'relative'
                                }}>
                                    {m.isCompleted ? (
                                        <CheckCircle2 size={19} color="#059669" strokeWidth={2.5} />
                                    ) : (
                                        <Lock size={15} color={isActive ? '#2563eb' : '#94a3b8'} />
                                    )}
                                    {isActive && !m.isCompleted && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: '-5px',
                                            borderRadius: '50%',
                                            border: '2px solid #3b82f6',
                                            animation: 'stage-pulse 1.8s ease infinite'
                                        }} />
                                    )}
                                </div>

                                {/* Body */}
                                <div style={{
                                    flex: 1,
                                    paddingTop: '2px',
                                    backgroundColor: isActive ? '#f8fafc' : 'transparent',
                                    padding: isActive ? '10px 14px' : '0',
                                    borderRadius: isActive ? '10px' : '0',
                                    border: isActive ? '1px solid #e2e8f0' : 'none'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{
                                                fontSize: '0.96rem',
                                                fontWeight: 800,
                                                color: m.isCompleted ? '#0f172a' : (isActive ? '#1e293b' : '#64748b'),
                                                lineHeight: 1.3
                                            }}>
                                                {m.name}
                                            </div>
                                            <div style={{
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                color: m.isCompleted ? '#059669' : (isActive ? '#2563eb' : '#64748b'),
                                                marginTop: '2px'
                                            }}>
                                                {m.label}
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            padding: '3px 10px',
                                            borderRadius: '12px',
                                            backgroundColor: m.isCompleted ? '#dcfce7' : (isActive ? '#eff6ff' : '#f1f5f9'),
                                            color: m.isCompleted ? '#166534' : (isActive ? '#1d4ed8' : '#64748b'),
                                            border: `1px solid ${m.isCompleted ? '#bbf7d0' : (isActive ? '#bfdbfe' : '#e2e8f0')}`,
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {m.isCompleted ? `✅ ₹${cumTarget.toLocaleString('en-IN')} Paid (${m.cumulativePercent}%)` : (isActive ? '⚡ In Progress' : '🔒 Locked')}
                                        </span>
                                    </div>

                                    {/* Stage Amount and Cumulative Target */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '20px',
                                        marginTop: '8px',
                                        fontSize: '0.8rem',
                                        flexWrap: 'wrap',
                                        backgroundColor: '#ffffff',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #f1f5f9',
                                        width: 'fit-content'
                                    }}>
                                        <div>
                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Stage Amount ({m.stagePercent}%):</span>{' '}
                                            <span style={{ color: '#2563eb', fontWeight: 800 }}>₹{stageAmt.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Cumulative Target ({m.cumulativePercent}%):</span>{' '}
                                            <span style={{ color: '#059669', fontWeight: 800 }}>₹{cumTarget.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SOW & PM QC Confirmation Gate right after Stage 2 (Masking Stage) */}
                            {idx === 1 && (
                                <div style={{
                                    margin: '12px 0 16px 54px',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: isPmAcceptedInQc ? '#f0fdf4' : '#fffbeb',
                                    border: `1.5px solid ${isPmAcceptedInQc ? '#bbf7d0' : '#fde68a'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    flexWrap: 'wrap'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ShieldCheck size={17} color={isPmAcceptedInQc ? '#166534' : '#b45309'} />
                                        <div>
                                            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: isPmAcceptedInQc ? '#166534' : '#92400e' }}>
                                                4. SOW done
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: isPmAcceptedInQc ? '#15803d' : '#b45309', fontWeight: 600 }}>
                                                Scope of Work sent for PM confirmation &amp; accepted in QC
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '3px 10px',
                                        borderRadius: '12px',
                                        backgroundColor: isPmAcceptedInQc ? '#dcfce7' : '#fef3c7',
                                        color: isPmAcceptedInQc ? '#15803d' : '#b45309',
                                        border: `1px solid ${isPmAcceptedInQc ? '#86efac' : '#fcd34d'}`,
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {isPmAcceptedInQc ? '✅ PM QC Accepted' : '⏳ PM QC Confirmation Req.'}
                                    </span>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            <style>{`
                @keyframes stage-pulse {
                    0%   { transform: scale(1); opacity: 0.8; }
                    50%  { transform: scale(1.2); opacity: 0.25; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
            `}</style>
        </div>
    );
};
