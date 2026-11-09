import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { getDepartmentInfo, DEPARTMENT_PRIORITY_ORDER } from '../utils/departmentUtils';

interface DepartmentPersonnelSelectorProps {
    team: any[];
    selectedUserId: string;
    onSelectUserId: (userId: string) => void;
    defaultDepartment?: string;
    roleContext?: 'mmt' | 'pm' | 'designer' | 'site_inspector';
    disabled?: boolean;
    label?: string;
    multiSelect?: boolean;
    allowedDepartments?: string[];
    hideAllTab?: boolean;
}

export const DepartmentPersonnelSelector: React.FC<DepartmentPersonnelSelectorProps> = ({
    team,
    selectedUserId,
    onSelectUserId,
    defaultDepartment,
    roleContext,
    disabled = false,
    label,
    multiSelect = false,
    allowedDepartments,
    hideAllTab = false
}) => {
    // Effective multiSelect mode (automatically enabled for MMT and Site Inspector role context or if multiSelect prop is true)
    const isMultiMode = multiSelect || roleContext === 'mmt' || roleContext === 'site_inspector';

    // Parse comma-separated or single selected ID into an array of string IDs
    const selectedIdArray = useMemo(() => {
        if (!selectedUserId) return [];
        return String(selectedUserId)
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }, [selectedUserId]);

    // Group team members by department
    const departmentMap = useMemo(() => {
        const map: Record<string, any[]> = {};
        team.forEach(u => {
            const dept = getDepartmentInfo(u).name;
            if (!map[dept]) map[dept] = [];
            map[dept].push(u);
        });
        return map;
    }, [team]);

    // Serialized key for allowedDepartments to avoid recreating dependencies on inline array literals
    const allowedDeptsKey = allowedDepartments && allowedDepartments.length > 0 ? allowedDepartments.join('|') : '';

    // Unique list of departments sorted by standard priority or restricted to allowedDepartments
    const departments = useMemo(() => {
        const keys = Object.keys(departmentMap);
        let list = DEPARTMENT_PRIORITY_ORDER.filter(d => keys.includes(d))
            .concat(keys.filter(k => !DEPARTMENT_PRIORITY_ORDER.includes(k)));
        if (allowedDepartments && allowedDepartments.length > 0) {
            return allowedDepartments;
        }
        return list;
    }, [departmentMap, allowedDeptsKey]);

    // Helper to calculate default department tab
    const computeInitialDept = () => {
        if (defaultDepartment) return defaultDepartment;
        let target = '';
        if (roleContext === 'mmt') target = 'MMT & Masking';
        else if (roleContext === 'pm') target = 'Project Management';
        else if (roleContext === 'designer') target = 'Design Department';
        else if (roleContext === 'site_inspector') target = 'Site Inspection & QC';

        if (target && departmentMap[target] && departmentMap[target].length > 0) {
            return target;
        }
        if (hideAllTab && departments.length > 0) {
            return departments[0];
        }
        return hideAllTab ? 'MMT & Masking' : 'all';
    };

    const [activeDeptTab, setActiveDeptTab] = useState<string>(() => computeInitialDept());
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Keep refs of previous roleContext and defaultDepartment to ONLY react when they genuinely change
    const prevRoleContextRef = useRef(roleContext);
    const prevDefaultDeptRef = useRef(defaultDepartment);

    // Update active department tab ONLY when roleContext or defaultDepartment actually changes
    useEffect(() => {
        const roleChanged = prevRoleContextRef.current !== roleContext;
        const defaultDeptChanged = prevDefaultDeptRef.current !== defaultDepartment;

        if (roleChanged || defaultDeptChanged) {
            prevRoleContextRef.current = roleContext;
            prevDefaultDeptRef.current = defaultDepartment;

            if (defaultDepartment) {
                setActiveDeptTab(defaultDepartment);
            } else {
                let target = '';
                if (roleContext === 'mmt') target = 'MMT & Masking';
                else if (roleContext === 'pm') target = 'Project Management';
                else if (roleContext === 'designer') target = 'Design Department';
                else if (roleContext === 'site_inspector') target = 'Site Inspection & QC';

                if (target && departmentMap[target] && departmentMap[target].length > 0) {
                    setActiveDeptTab(target);
                } else if (hideAllTab && departments.length > 0) {
                    setActiveDeptTab(departments[0]);
                } else {
                    setActiveDeptTab('all');
                }
            }
        }
    }, [roleContext, defaultDepartment, departmentMap, departments, hideAllTab]);

    // Safety fallback: only if the currently active tab is completely absent from available departments
    useEffect(() => {
        if (activeDeptTab !== 'all' && departments.length > 0 && !departments.includes(activeDeptTab)) {
            setActiveDeptTab(hideAllTab ? departments[0] : 'all');
        }
    }, [activeDeptTab, departments, hideAllTab]);

    // Filter members based on active department and search query
    const filteredGroups = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const result: { deptName: string; members: any[] }[] = [];

        departments.forEach(deptName => {
            if (activeDeptTab !== 'all' && activeDeptTab !== deptName) return;

            let members = departmentMap[deptName] || [];
            if (query) {
                members = members.filter(u =>
                    String(u.name || '').toLowerCase().includes(query) ||
                    String(u.role || '').toLowerCase().includes(query) ||
                    String(u.department || '').toLowerCase().includes(query)
                );
            }

            if (members.length > 0) {
                result.push({ deptName, members });
            }
        });

        return result;
    }, [departmentMap, departments, activeDeptTab, searchQuery]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {label && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>
                            {label}
                        </label>
                        {selectedIdArray.length > 0 && (
                            <span style={{ fontSize: '0.70rem', backgroundColor: '#ea580c', color: '#ffffff', padding: '1px 8px', borderRadius: '10px', fontWeight: 800 }}>
                                {selectedIdArray.length} {selectedIdArray.length === 1 ? 'selected' : 'selected'}
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {isMultiMode ? 'Multi-Select Enabled' : 'Single Select'}
                    </span>
                </div>
            )}

            {/* Department Navigation Pills */}
            <div style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                paddingBottom: '4px',
                maxWidth: '100%',
                boxSizing: 'border-box'
            }}>
                {!hideAllTab && (
                    <button
                        type="button"
                        onClick={() => setActiveDeptTab('all')}
                        style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            border: activeDeptTab === 'all' ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                            backgroundColor: activeDeptTab === 'all' ? '#0f172a' : '#ffffff',
                            color: activeDeptTab === 'all' ? '#ffffff' : '#64748b',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        All Staff ({team.length})
                    </button>
                )}

                {departments.map(deptName => {
                    const info = getDepartmentInfo(departmentMap[deptName]?.[0] || { department: deptName });
                    const count = departmentMap[deptName]?.length || 0;
                    const isActive = activeDeptTab === deptName;

                    return (
                        <button
                            key={deptName}
                            type="button"
                            onClick={() => setActiveDeptTab(deptName)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: isActive ? `1.5px solid ${info.color}` : '1px solid #e2e8f0',
                                backgroundColor: isActive ? info.bgColor : '#ffffff',
                                color: isActive ? info.color : '#475569',
                                fontSize: '0.74rem',
                                fontWeight: isActive ? 800 : 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: isActive ? `0 1px 3px ${info.borderColor}` : 'none'
                            }}
                        >
                            <span>{info.icon}</span>
                            <span>{deptName}</span>
                            <span style={{
                                fontSize: '0.68rem',
                                padding: '1px 5px',
                                borderRadius: '10px',
                                backgroundColor: isActive ? info.color : '#f1f5f9',
                                color: isActive ? '#ffffff' : '#64748b'
                            }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search Filter for Fast Member Lookup */}
            <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                    type="text"
                    placeholder="Search member by name or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={disabled}
                    style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.80rem',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                    }}
                />
            </div>

            {/* Department Grouped Member Checklist */}
            <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: disabled ? '#f8fafc' : '#ffffff'
            }}>
                {filteredGroups.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 8px', color: '#64748b', fontSize: '0.82rem' }}>
                        No members found in {activeDeptTab === 'all' ? 'any department' : activeDeptTab}.
                        {activeDeptTab !== 'all' && (
                            <div style={{ marginTop: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => setActiveDeptTab('all')}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        color: '#ea580c',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.78rem'
                                    }}
                                >
                                    Browse All Departments ({team.length})
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    filteredGroups.map(group => {
                        const sampleUser = group.members[0] || {};
                        const info = getDepartmentInfo(sampleUser);

                        return (
                            <div key={group.deptName} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {/* Department Header Banner */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: info.bgColor,
                                    border: `1px solid ${info.borderColor}`,
                                    color: info.color,
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.3px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{info.icon}</span>
                                        <span>{group.deptName.toUpperCase()}</span>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>
                                        {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                                    </span>
                                </div>

                                {/* Member Rows */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
                                    {group.members.map(u => {
                                        const uidStr = String(u.user_id);
                                        const isSelected = selectedIdArray.includes(uidStr);

                                        const handleRowClick = (e: React.MouseEvent) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (disabled) return;
                                            if (isMultiMode) {
                                                if (isSelected) {
                                                    const next = selectedIdArray.filter(id => id !== uidStr);
                                                    onSelectUserId(next.join(','));
                                                } else {
                                                    const next = [...selectedIdArray, uidStr];
                                                    onSelectUserId(next.join(','));
                                                }
                                            } else {
                                                onSelectUserId(isSelected ? '' : uidStr);
                                            }
                                        };

                                        return (
                                            <div
                                                key={u.user_id}
                                                role="button"
                                                onClick={handleRowClick}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    backgroundColor: isSelected ? '#fff7ed' : 'transparent',
                                                    border: isSelected ? '1.5px solid #ea580c' : '1px solid transparent',
                                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    userSelect: 'none'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected && !disabled) e.currentTarget.style.backgroundColor = '#f8fafc';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected && !disabled) e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={disabled}
                                                        readOnly
                                                        style={{ pointerEvents: 'none', cursor: 'inherit', accentColor: '#ea580c', width: '15px', height: '15px' }}
                                                    />
                                                    <span style={{
                                                        fontSize: '0.84rem',
                                                        fontWeight: isSelected ? 800 : 600,
                                                        color: isSelected ? '#ea580c' : '#1e293b'
                                                    }}>
                                                        {u.name}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        color: '#64748b',
                                                        backgroundColor: '#f1f5f9',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px'
                                                    }}>
                                                        {u.role || 'Staff'}
                                                    </span>
                                                    {isSelected && (
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            backgroundColor: '#ffedd5',
                                                            color: '#c2410c',
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            fontWeight: 800
                                                        }}>
                                                            ✓ Selected
                                                        </span>
                                                    )}
                                                </div>

                                                <span style={{
                                                    fontSize: '0.68rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    backgroundColor: info.bgColor,
                                                    color: info.color,
                                                    border: `1px solid ${info.borderColor}`,
                                                    fontWeight: 700
                                                }}>
                                                    {group.deptName}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
