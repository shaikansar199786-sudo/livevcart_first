const fs = require('fs');
const path = require('path');

// 1. Update D1Leads.tsx
const d1Path = path.resolve('demoark/frontend/src/pages/D1Leads.tsx');
let d1 = fs.readFileSync(d1Path, 'utf8').replace(/\r\n/g, '\n');

const targetD1Hook = `  useEffect(() => {
    if (hasHandledUrlParamsRef.current) return;
    const params = new URLSearchParams(location.search);
    const openMmts = params.get('open_mmts');
    const openQc = params.get('open_qc');
    const targetLeadId = params.get('lead_id');

    if (openMmts === 'true' && targetLeadId && leads.length > 0) {
      const matchLead = leads.find(l => String(l.lead_id) === String(targetLeadId) || String(l.manual_client_id) === String(targetLeadId) || String(l.project_code) === String(targetLeadId));
      if (matchLead) {
        hasHandledUrlParamsRef.current = true;
        openLeadModal(matchLead);
        setModalTab('mmts');
        setSiteModalRoleTab('mmt');
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (openQc === 'true' && targetLeadId && leads.length > 0) {
      const matchLead = leads.find(l => String(l.lead_id) === String(targetLeadId) || String(l.manual_client_id) === String(targetLeadId) || String(l.project_code) === String(targetLeadId));
      if (matchLead) {
        hasHandledUrlParamsRef.current = true;
        openLeadModal(matchLead);
        setModalTab('qc');
        setSiteModalRoleTab('site_inspector');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [location.search, leads]);`;

const replD1Hook = `  useEffect(() => {
    if (hasHandledUrlParamsRef.current) return;
    const params = new URLSearchParams(location.search);
    const openMmts = params.get('open_mmts');
    const openQc = params.get('open_qc');
    const targetLeadId = params.get('lead_id');

    const candidates = (allLeadsData && allLeadsData.length > 0) ? allLeadsData : leads;
    if ((openMmts === 'true' || openQc === 'true') && targetLeadId && candidates.length > 0) {
      const matchLead = candidates.find(l => 
        String(l.lead_id) === String(targetLeadId) || 
        String(l.id) === String(targetLeadId) || 
        String(l.manual_client_id) === String(targetLeadId) || 
        String((l as any).project_code) === String(targetLeadId) ||
        String((l as any).converted_project_id) === String(targetLeadId) ||
        String((l as any).project_id) === String(targetLeadId) ||
        (l.client_name && targetLeadId.toLowerCase().includes(l.client_name.toLowerCase()))
      );
      if (matchLead) {
        hasHandledUrlParamsRef.current = true;
        openLeadModal(matchLead);
        if (openMmts === 'true') {
          setModalTab('mmts');
          setSiteModalRoleTab('mmt');
        } else if (openQc === 'true') {
          setModalTab('qc');
          setSiteModalRoleTab('site_inspector');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [location.search, leads, allLeadsData]);`;

if (d1.includes(targetD1Hook)) {
    d1 = d1.replace(targetD1Hook, replD1Hook);
    console.log('D1Leads: URL param effect updated');
} else {
    console.log('D1Leads: targetD1Hook not matched');
}

const targetD1Fetch = `        if (!hasHandledUrlParamsRef.current && targetLeadId && allLeads.length > 0) {
          const matched = allLeads.find(l => 
            String(l.lead_id) === String(targetLeadId) || 
            String(l.id) === String(targetLeadId) || 
            String(l.manual_client_id) === String(targetLeadId) || 
            String((l as any).project_code) === String(targetLeadId) ||
            (l.client_name && targetLeadId.toLowerCase().includes(l.client_name.toLowerCase()))
          );
          if (matched) {
            hasHandledUrlParamsRef.current = true;
            setViewingLeadModal(matched);
            if (openMmts === 'true') {
              setModalTab('mmts');
              setSiteModalRoleTab('mmt');
            } else if (openQc === 'true') {
              const is20Paid = isTwentyPercentPaidForLead(matched) || isTenPercentPaidForLead(matched);
              if (is20Paid) {
                setModalTab('qc');
              } else {
                setModalTab('files');
                setCollectLead(matched);
                const bVal = parseFloat(matched.total_budget as any) || parseFloat(matched.estimated_budget as any) || 0;
                const req10 = Math.round(bVal * 0.10) || 5000;
                setCollectAmount(String(req10));
                setShowCollectModal(true);
              }
            }
            window.history.replaceState({}, '', window.location.pathname);
          }`;

const replD1Fetch = `        if (!hasHandledUrlParamsRef.current && targetLeadId && allLeads.length > 0) {
          const matched = allLeads.find(l => 
            String(l.lead_id) === String(targetLeadId) || 
            String(l.id) === String(targetLeadId) || 
            String(l.manual_client_id) === String(targetLeadId) || 
            String((l as any).project_code) === String(targetLeadId) ||
            String((l as any).converted_project_id) === String(targetLeadId) ||
            String((l as any).project_id) === String(targetLeadId) ||
            (l.client_name && targetLeadId.toLowerCase().includes(l.client_name.toLowerCase()))
          );
          if (matched) {
            hasHandledUrlParamsRef.current = true;
            openLeadModal(matched);
            if (openMmts === 'true') {
              setModalTab('mmts');
              setSiteModalRoleTab('mmt');
            } else if (openQc === 'true') {
              setModalTab('qc');
              setSiteModalRoleTab('site_inspector');
            }
            window.history.replaceState({}, '', window.location.pathname);
          }`;

if (d1.includes(targetD1Fetch)) {
    d1 = d1.replace(targetD1Fetch, replD1Fetch);
    console.log('D1Leads: fetchLeads URL param handler updated');
} else {
    console.log('D1Leads: targetD1Fetch not matched');
}

fs.writeFileSync(d1Path, d1.replace(/\n/g, '\r\n'), 'utf8');

// 2. Update ProjectDetails.tsx
const pdPath = path.resolve('demoark/frontend/src/pages/ProjectDetails.tsx');
let pd = fs.readFileSync(pdPath, 'utf8').replace(/\r\n/g, '\n');

const targetSlotSection = `            {/* 4 Status Badges Bar (Agreement | Slot Booked | Stage & Paid % | Sign) */}
            {(() => {
                const isSlotBooked = Boolean(
                    (project?.qc_status && ['booked', 'approved', 'qc_approved', 'in_meeting', 'completed'].includes(String(project.qc_status).toLowerCase())) ||
                    (project?.mmts_status && ['booked', 'in_meeting', 'meeting_completed', 'completed'].includes(String(project.mmts_status).toLowerCase())) ||
                    (project?.mmts_booking_time && project.mmts_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.qc_booking_time && project.lead_info.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.d1_booking_time && project.lead_info.d1_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.site_manager_booking_time && project.lead_info.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.mmts_booking_time && project.lead_info.mmts_booking_time !== '0000-00-00 00:00:00')
                );

                const autoStageInfo = project ? computeProjectAutoStage(project, transactions) : null;
                const currentStage = autoStageInfo?.stage || project?.project_stage || 'Quality check done';
                const currentPaidPercent = autoStageInfo?.paidPercent ?? (project?.total_budget > 0 ? (project.total_paid / project.total_budget) * 100 : 0);
                const stageCfg = STAGE_COLORS[currentStage] || { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
                const hasSignature = Boolean(project?.client_signature && String(project.client_signature).length > 20);

                return (
                    <div className="no-print" style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginBottom: '18px',
                        marginTop: '4px'
                    }}>
                        {/* 1. Agreement */}
                        <button
                            type="button"
                            onClick={() => {
                                const targetPid = project.project_id || project.project_code || id;
                                navigate(\`/agreements?project_id=\${encodeURIComponent(targetPid)}\`);
                            }}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: '1.5px solid #22c55e',
                                backgroundColor: '#f0fdf4',
                                color: '#15803d',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={existingAgreement ? \`Agreement active (Ref: \${existingAgreement.ref_id || existingAgreement.id}) - Click to open\` : "Click to view or create project agreement"}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(34,197,94,0.18)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>📜</span> Agreement
                        </button>

                        {/* 2. Slot Booked */}
                        <button
                            type="button"
                            onClick={() => setShowSlotModal(true)}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: '1.5px solid #0284c7',
                                backgroundColor: '#f0f9ff',
                                color: '#0284c7',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={isSlotBooked ? "Slot booked - Click to view/manage schedule" : "Click to view/book slot"}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(2,132,199,0.18)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>✓</span> Slot Booked
                        </button>`;

const replSlotSection = `            {/* 4 Status Badges Bar (Agreement | Dynamic Slot Lifecycle | Stage & Paid % | Sign) */}
            {(() => {
                const totalPaidCredit = (transactions || [])
                    .filter((t: any) => String(t.type || '').toLowerCase().trim() === 'credit')
                    .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
                const totalBudgetVal = parseFloat(project?.total_budget || 0);
                const calcPaidPct = totalBudgetVal > 0 ? (totalPaidCredit / totalBudgetVal) * 100 : 0;

                const is10PercentPaid = calcPaidPct >= 9.9 || Boolean(project?.is_10_percent_paid);
                const is20PercentPaid = calcPaidPct >= 19.9 || Boolean(project?.is_20_percent_paid) || Boolean(project?.stage2_paid);

                const mmtsSt = String(project?.mmts_status || project?.lead_info?.mmts_status || '').toLowerCase().trim();
                const hasMmtsTime = Boolean(
                    (project?.mmts_booking_time && project.mmts_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.mmts_booking_time && project.lead_info.mmts_booking_time !== '0000-00-00 00:00:00')
                );
                const isMmtsBooked = hasMmtsTime || ['booked', 'in_meeting', 'meeting_completed', 'completed'].includes(mmtsSt);
                const isMmtsEnded = ['meeting_completed', 'completed', 'approved'].includes(mmtsSt);

                const qcSt = String(project?.qc_status || project?.lead_info?.qc_status || '').toLowerCase().trim();
                const hasQcTime = Boolean(
                    (project?.qc_booking_time && project.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.qc_booking_time && project.lead_info.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.site_manager_booking_time && project.lead_info.site_manager_booking_time !== '0000-00-00 00:00:00')
                );
                const isQcBooked = hasQcTime || ['booked', 'approved', 'qc_approved', 'in_meeting', 'completed'].includes(qcSt);
                const isQcEnded = ['completed', 'approved', 'qc_approved', 'meeting_completed'].includes(qcSt);

                // Automatic Slot Lifecycle mapping:
                // 1. Before Stage 1 Payment -> Slot Booking
                // 2. After Stage 1 Payment -> Book MMTS Slot (redirects to 📦 MMTS Team & PM)
                // 3. MMTS Slot Booked -> MMTS Slot Booked (redirects to 📦 MMTS Team & PM)
                // 4. MMTS ended & Stage 2 Payment done -> Book QC Slot (redirects to 🔍 QC Inspector & PM)
                // 5. QC Slot Booked -> QC Slot Booked (redirects to 🔍 QC Inspector & PM)
                // 6. QC ended -> Slot Booked
                let slotConfig = {
                    label: 'Slot Booking',
                    icon: '📅',
                    color: '#c2410c',
                    bg: '#fff7ed',
                    border: '#fed7aa',
                    target: 'mmts',
                    tooltip: 'Requires Stage 1 (10% Token) payment to book MMTS slot'
                };

                if (!is10PercentPaid) {
                    slotConfig = {
                        label: 'Slot Booking',
                        icon: '📅',
                        color: '#c2410c',
                        bg: '#fff7ed',
                        border: '#fed7aa',
                        target: 'mmts',
                        tooltip: 'Requires Stage 1 (10% Token) payment to book MMTS slot'
                    };
                } else if (!isMmtsBooked) {
                    slotConfig = {
                        label: 'Book MMTS Slot',
                        icon: '📦',
                        color: '#ea580c',
                        bg: '#fff7ed',
                        border: '#fdba74',
                        target: 'mmts',
                        tooltip: 'Stage 1 Paid! Click to open schedule for 📦 MMTS Team & PM'
                    };
                } else if (isMmtsBooked && !isMmtsEnded && !is20PercentPaid) {
                    slotConfig = {
                        label: 'MMTS Slot Booked',
                        icon: '✓',
                        color: '#0284c7',
                        bg: '#f0f9ff',
                        border: '#7dd3fc',
                        target: 'mmts',
                        tooltip: 'MMTS Slot Booked! Click to view 📦 MMTS Team & PM meeting schedule'
                    };
                } else if (!is20PercentPaid) {
                    slotConfig = {
                        label: isMmtsEnded ? '✓ MMTS Done (Pay Stage 2)' : 'MMTS Slot Booked',
                        icon: isMmtsEnded ? '✓' : '📦',
                        color: '#0284c7',
                        bg: '#f0f9ff',
                        border: '#7dd3fc',
                        target: 'mmts',
                        tooltip: 'MMTS meeting finished. Record Stage 2 (20%) payment to unlock QC Inspector Slot'
                    };
                } else if (is20PercentPaid && !isQcBooked) {
                    slotConfig = {
                        label: 'Book QC Slot',
                        icon: '🔍',
                        color: '#2563eb',
                        bg: '#eff6ff',
                        border: '#93c5fd',
                        target: 'qc',
                        tooltip: 'Stage 2 Paid! Click to open schedule for 🔍 QC Inspector & PM'
                    };
                } else if (isQcBooked && !isQcEnded) {
                    slotConfig = {
                        label: 'QC Slot Booked',
                        icon: '✓',
                        color: '#16a34a',
                        bg: '#f0fdf4',
                        border: '#86efac',
                        target: 'qc',
                        tooltip: 'QC Slot Booked! Click to view 🔍 QC Inspector & PM inspection schedule'
                    };
                } else {
                    slotConfig = {
                        label: 'Slot Booked',
                        icon: '✓',
                        color: '#15803d',
                        bg: '#f0fdf4',
                        border: '#22c55e',
                        target: 'qc',
                        tooltip: '✓ All MMTS & QC Slots Booked & Completed! Click to view schedule history'
                    };
                }

                const autoStageInfo = project ? computeProjectAutoStage(project, transactions) : null;
                const currentStage = autoStageInfo?.stage || project?.project_stage || 'Quality check done';
                const currentPaidPercent = autoStageInfo?.paidPercent ?? (project?.total_budget > 0 ? (project.total_paid / project.total_budget) * 100 : 0);
                const stageCfg = STAGE_COLORS[currentStage] || { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
                const hasSignature = Boolean(project?.client_signature && String(project.client_signature).length > 20);

                return (
                    <div className="no-print" style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginBottom: '18px',
                        marginTop: '4px'
                    }}>
                        {/* 1. Agreement */}
                        <button
                            type="button"
                            onClick={() => {
                                const targetPid = project.project_id || project.project_code || id;
                                navigate(\`/agreements?project_id=\${encodeURIComponent(targetPid)}\`);
                            }}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: '1.5px solid #22c55e',
                                backgroundColor: '#f0fdf4',
                                color: '#15803d',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={existingAgreement ? \`Agreement active (Ref: \${existingAgreement.ref_id || existingAgreement.id}) - Click to open\` : "Click to view or create project agreement"}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(34,197,94,0.18)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>📜</span> Agreement
                        </button>

                        {/* 2. Slot Lifecycle Dynamic Pill (Direct Redirect to MMTS / QC schedule) */}
                        <button
                            type="button"
                            onClick={() => {
                                const targetPid = project?.lead_info?.lead_id || 
                                                 project?.converted_from_lead_id || 
                                                 project?.lead_id || 
                                                 project?.project_code || 
                                                 project?.project_id || 
                                                 id;
                                if (slotConfig.target === 'qc') {
                                    navigate(\`/d1-leads?lead_id=\${encodeURIComponent(targetPid)}&open_qc=true\`);
                                } else {
                                    navigate(\`/d1-leads?lead_id=\${encodeURIComponent(targetPid)}&open_mmts=true\`);
                                }
                            }}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: \`1.5px solid \${slotConfig.border}\`,
                                backgroundColor: slotConfig.bg,
                                color: slotConfig.color,
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={slotConfig.tooltip}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = \`0 3px 8px \${slotConfig.border}\`; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>{slotConfig.icon}</span> {slotConfig.label}
                        </button>`;

if (pd.includes(targetSlotSection)) {
    pd = pd.replace(targetSlotSection, replSlotSection);
    console.log('ProjectDetails: Dynamic slot lifecycle pill updated');
} else {
    console.log('ProjectDetails: targetSlotSection not matched');
}

fs.writeFileSync(pdPath, pd.replace(/\n/g, '\r\n'), 'utf8');
console.log('All updates complete');

