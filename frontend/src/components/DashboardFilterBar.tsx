import React, { useState } from 'react';
import { Calendar, Layers, Check, ChevronDown, RotateCcw } from 'lucide-react';

export type StatementPeriodType = 'all' | 'today' | 'this_month' | 'this_year' | 'last_month' | 'last_3_months' | 'last_6_months' | 'custom' | `year_${number}`;
export type ProjectTypeFilter = 'all' | 'furniture' | 'interior' | 'commercial';

interface DashboardFilterBarProps {
    statementPeriod: StatementPeriodType;
    onStatementPeriodChange: (period: StatementPeriodType, customDates?: { startDate: string; endDate: string }) => void;
    projectType: ProjectTypeFilter;
    onProjectTypeChange: (type: ProjectTypeFilter) => void;
    initialStartDate?: string;
    initialEndDate?: string;
    className?: string;
    onResetFilters?: () => void;
}

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
    statementPeriod,
    onStatementPeriodChange,
    projectType,
    onProjectTypeChange,
    initialStartDate = '',
    initialEndDate = '',
    className = '',
    onResetFilters
}) => {
    const [startDate, setStartDate] = useState<string>(initialStartDate);
    const [endDate, setEndDate] = useState<string>(initialEndDate);
    const [showYearDropdown, setShowYearDropdown] = useState(false);

    const currentYear = new Date().getFullYear();
    // Current year + 4 previous years
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    const statementPeriods: { id: StatementPeriodType; label: string }[] = [
        { id: 'all', label: 'All Time' },
        { id: 'today', label: 'Today (Daily)' },
        { id: 'this_month', label: 'This Month' },
        { id: 'this_year', label: 'This Year' },
        { id: 'last_month', label: 'Last Month' },
        { id: 'last_3_months', label: 'Last 3 Months' },
        { id: 'last_6_months', label: 'Last 6 Months' },
    ];

    const projectTypes: { id: ProjectTypeFilter; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'furniture', label: 'Furniture Projects' },
        { id: 'interior', label: 'Interior Projects' },
        { id: 'commercial', label: 'Commercial Projects' },
    ];

    const handleApplyCustomDates = () => {
        if (startDate && endDate) {
            onStatementPeriodChange('custom', { startDate, endDate });
        }
    };

    const handleReset = () => {
        setStartDate('');
        setEndDate('');
        onStatementPeriodChange('all');
        onProjectTypeChange('all');
        if (onResetFilters) {
            onResetFilters();
        }
    };

    const selectedYear = statementPeriod.startsWith('year_')
        ? parseInt(statementPeriod.replace('year_', ''))
        : null;
    const isYearActive = selectedYear !== null;
    const getYearLabel = () => isYearActive ? `Year: ${selectedYear}` : 'By Year';
    const isFiltered = statementPeriod !== 'all' || projectType !== 'all' || startDate !== '' || endDate !== '';

    return (
        <div className={`dashboard-filter-bar ${className}`} style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1.5px solid #ffe8c2',
            padding: '16px 20px',
            marginBottom: '24px',
            boxShadow: '0 4px 14px rgba(252, 164, 18, 0.08)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* STATEMENT PERIOD FILTER ROW */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
                        <Calendar size={18} color="#fca412" />
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0c1527', letterSpacing: '-0.2px' }}>
                            Statement Period:
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                        {statementPeriods.map((period) => {
                            const isActive = statementPeriod === period.id;
                            return (
                                <button
                                    key={period.id}
                                    onClick={() => onStatementPeriodChange(period.id)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '7px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.82rem',
                                        fontWeight: isActive ? 800 : 600,
                                        border: isActive ? '1.5px solid #fca412' : '1.5px solid #cbd5e1',
                                        backgroundColor: isActive ? '#fca412' : '#ffffff',
                                        color: isActive ? '#ffffff' : '#475569',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        boxShadow: isActive ? '0 2px 8px rgba(252, 164, 18, 0.35)' : 'none'
                                    }}
                                >
                                    {isActive && <Check size={14} color="#ffffff" />}
                                    {period.label}
                                </button>
                            );
                        })}

                        {/* YEAR DROPDOWN */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowYearDropdown(prev => !prev)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '7px 14px',
                                    borderRadius: '20px',
                                    fontSize: '0.82rem',
                                    fontWeight: isYearActive ? 800 : 600,
                                    border: isYearActive ? '1.5px solid #fca412' : '1.5px solid #cbd5e1',
                                    backgroundColor: isYearActive ? '#fca412' : '#ffffff',
                                    color: isYearActive ? '#ffffff' : '#475569',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: isYearActive ? '0 2px 8px rgba(252, 164, 18, 0.35)' : 'none'
                                }}
                            >
                                {isYearActive && <Check size={14} color="#ffffff" />}
                                {getYearLabel()}
                                <ChevronDown size={13} color={isYearActive ? '#ffffff' : '#475569'} />
                            </button>

                            {showYearDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    backgroundColor: '#ffffff',
                                    border: '1.5px solid #ffe8c2',
                                    borderRadius: '10px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                                    zIndex: 200,
                                    minWidth: '130px',
                                    overflow: 'hidden'
                                }}>
                                    {years.map((yr) => {
                                        const isSelected = selectedYear === yr;
                                        return (
                                            <button
                                                key={yr}
                                                onClick={() => {
                                                    onStatementPeriodChange(`year_${yr}` as StatementPeriodType);
                                                    setShowYearDropdown(false);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    width: '100%',
                                                    padding: '9px 16px',
                                                    border: 'none',
                                                    backgroundColor: isSelected ? '#fff9f0' : '#ffffff',
                                                    color: isSelected ? '#fca412' : '#334155',
                                                    fontSize: '0.85rem',
                                                    fontWeight: isSelected ? 800 : 500,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    borderBottom: '1px solid #f1f5f9',
                                                    transition: 'background 0.12s'
                                                }}
                                            >
                                                {yr}
                                                {isSelected && <Check size={13} color="#fca412" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* CUSTOM DATE RANGE BUTTON */}
                        <button
                            onClick={() => onStatementPeriodChange('custom')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 14px',
                                borderRadius: '20px',
                                fontSize: '0.82rem',
                                fontWeight: statementPeriod === 'custom' ? 800 : 600,
                                border: statementPeriod === 'custom' ? '1.5px solid #fca412' : '1.5px solid #cbd5e1',
                                backgroundColor: statementPeriod === 'custom' ? '#fca412' : '#ffffff',
                                color: statementPeriod === 'custom' ? '#ffffff' : '#475569',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: statementPeriod === 'custom' ? '0 2px 8px rgba(252, 164, 18, 0.35)' : 'none'
                            }}
                        >
                            {statementPeriod === 'custom' && <Check size={14} color="#ffffff" />}
                            Custom Range
                        </button>
                    </div>
                </div>

                {/* CUSTOM DATE RANGE PICKER */}
                {statementPeriod === 'custom' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        backgroundColor: '#fff9f0',
                        borderRadius: '8px',
                        border: '1px solid #ffe8c2',
                        marginLeft: '172px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fca412' }}>From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #ffe8c2', fontSize: '0.82rem', color: '#0f172a', outline: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fca412' }}>To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #ffe8c2', fontSize: '0.82rem', color: '#0f172a', outline: 'none' }}
                            />
                        </div>
                        <button
                            onClick={handleApplyCustomDates}
                            style={{ padding: '5px 14px', borderRadius: '6px', backgroundColor: '#fca412', color: '#ffffff', border: 'none', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(252, 164, 18, 0.3)' }}
                        >
                            Apply Custom Range
                        </button>
                    </div>
                )}

                {/* DIVIDER */}
                <div style={{ height: '1px', backgroundColor: '#ffe8c2', opacity: 0.6 }} />

                {/* PROJECT TYPE FILTER ROW & RESET BUTTON */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
                            <Layers size={18} color="#fca412" />
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
                                Project Type:
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {projectTypes.map((type) => {
                                const isActive = projectType === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => onProjectTypeChange(type.id)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '7px 16px',
                                            borderRadius: '20px',
                                            fontSize: '0.82rem',
                                            fontWeight: isActive ? 800 : 600,
                                            border: isActive ? '1.5px solid #fca412' : '1.5px solid #cbd5e1',
                                            backgroundColor: isActive ? '#fca412' : '#ffffff',
                                            color: isActive ? '#ffffff' : '#475569',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            boxShadow: isActive ? '0 2px 8px rgba(252, 164, 18, 0.35)' : 'none'
                                        }}
                                    >
                                        {isActive && <Check size={14} color="#ffffff" />}
                                        {type.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ALWAYS VISIBLE / CLICKABLE RESET FILTERS BUTTON */}
                    {(isFiltered || onResetFilters) && (
                        <button
                            onClick={handleReset}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 16px',
                                borderRadius: '20px',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                border: '1.5px solid #ef4444',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)'
                            }}
                            title="Reset all filters to default"
                        >
                            <RotateCcw size={14} color="#ef4444" />
                            Reset Filters
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};
