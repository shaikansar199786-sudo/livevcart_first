import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    Calendar,
    Clock,
    UserCheck,
    Briefcase,
    Phone,
    MapPin,
    CheckCircle2,
    AlertCircle,
    User,
    Shield,
    Layers,
    Search,
    RefreshCw,
    Play
} from 'lucide-react';

interface BookedSlotLead {
    lead_id: number | string;
    client_name: string;
    contact_number?: string;
    email?: string;
    location?: string;
    client_address?: string;
    project_type?: string;
    estimated_budget?: string;
    status: string;
    qc_status?: string;
    site_inspector_status?: string;
    site_manager_status?: string;
    mmts_status?: string;
    d1_status?: string;
    d1_booking_time?: string;
    mmts_booking_time?: string;
    site_manager_booking_time?: string;
    d1_notes?: string;
    mmts_notes?: string;
    site_manager_notes?: string;
    d1_assigned_to?: any;
    site_manager_assigned_to?: any;
    mmt_assigned_id?: any;
    mmt_assigned_name?: string;
    site_inspector_assigned_id?: any;
    site_inspector_assigned_name?: string;
    associate_designer_assigned_id?: any;
    associate_designer_assigned_name?: string;
    pm_assigned_id?: any;
    pm_assigned_name?: string;
    created_at?: string;
}

interface BookedSlotsProps {
    isQcTabUnlocked?: boolean;
    initialTab?: 'mmt' | 'site_inspector' | 'associate_designer' | 'pm';
    defaultTab?: 'mmt' | 'site_inspector' | 'associate_designer' | 'pm';
    onRequirePayment?: () => void;
}

export const BookedSlotsPersonnelTab: React.FC<BookedSlotsProps> = ({ isQcTabUnlocked = true, initialTab, defaultTab = 'mmt', onRequirePayment }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'mmt' | 'site_inspector' | 'associate_designer' | 'pm'>(initialTab || defaultTab);
    const [leads, setLeads] = useState<BookedSlotLead[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [nowTick, setNowTick] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchBookedSlots();
    }, []);

    const fetchBookedSlots = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/leads`);
            if (res.data && res.data.success) {
                const all: BookedSlotLead[] = res.data.data || [];
                // Filter leads that have slot bookings
                const booked = all.filter(l =>
                    l.d1_booking_time ||
                    l.mmts_booking_time ||
                    l.site_manager_booking_time ||
                    l.mmt_assigned_name ||
                    l.site_inspector_assigned_name ||
                    l.associate_designer_assigned_name ||
                    l.pm_assigned_name
                );
                setLeads(booked);
            }
        } catch (err) {
            console.error('Failed to fetch booked slots', err);
        } finally {
            setLoading(false);
        }
    };

    const isSiteInspectorLead = (l: any) => {
        const hasName = Boolean(l.site_inspector_assigned_name && l.site_inspector_assigned_name.trim() !== '' && l.site_inspector_assigned_name !== 'Not assigned' && l.site_inspector_assigned_name !== 'Pending Assignment');
        const hasId = Boolean(l.site_inspector_assigned_id && String(l.site_inspector_assigned_id) !== '0' && String(l.site_inspector_assigned_id) !== 'null');
        const hasSm = Boolean(l.site_manager_assigned_to && String(l.site_manager_assigned_to) !== '0' && String(l.site_manager_assigned_to) !== 'null');
        const hasTime = Boolean(
            (l.site_manager_booking_time && String(l.site_manager_booking_time).trim() !== '' && l.site_manager_booking_time !== '0000-00-00 00:00:00') ||
            (l.qc_booking_time && String(l.qc_booking_time).trim() !== '' && l.qc_booking_time !== '0000-00-00 00:00:00')
        );
        const hasStatus = Boolean(
            (l.site_inspector_status && !['enquiry', 'pending', 'draft'].includes(String(l.site_inspector_status).toLowerCase())) ||
            (l.qc_status && !['enquiry', 'pending', 'draft'].includes(String(l.qc_status).toLowerCase()))
        );
        return hasName || hasId || hasSm || hasTime || hasStatus;
    };

    const isMmtLead = (l: any) => {
        const hasName = Boolean(l.mmt_assigned_name && l.mmt_assigned_name.trim() !== '' && l.mmt_assigned_name !== 'Not assigned');
        const hasId = Boolean(l.mmt_assigned_id && String(l.mmt_assigned_id) !== '0' && String(l.mmt_assigned_id) !== 'null');
        const hasTime = Boolean(l.mmts_booking_time && String(l.mmts_booking_time).trim() !== '' && l.mmts_booking_time !== '0000-00-00 00:00:00');
        const hasStatus = Boolean(
            (l.mmts_status && !['enquiry', 'pending', 'draft'].includes(String(l.mmts_status).toLowerCase())) ||
            (l.status && l.status.toLowerCase().includes('mmt'))
        );
        return hasName || hasId || hasTime || hasStatus;
    };

    const isDesignerLead = (l: any) => {
        const hasName = Boolean(l.associate_designer_assigned_name && l.associate_designer_assigned_name.trim() !== '' && l.associate_designer_assigned_name !== 'Not assigned');
        const hasId = Boolean(l.d1_assigned_to && String(l.d1_assigned_to) !== '0' && String(l.d1_assigned_to) !== 'null');
        const hasTime = Boolean(l.d1_booking_time && String(l.d1_booking_time).trim() !== '' && l.d1_booking_time !== '0000-00-00 00:00:00');
        return hasName || hasId || hasTime;
    };

    const isPmLead = (l: any) => {
        const hasName = Boolean(l.pm_assigned_name && l.pm_assigned_name.trim() !== '' && l.pm_assigned_name !== 'Not assigned');
        const hasId = Boolean(l.pm_assigned_id && String(l.pm_assigned_id) !== '0' && String(l.pm_assigned_id) !== 'null');
        const hasStatus = Boolean(l.status && l.status.toLowerCase().includes('pm'));
        return hasName || hasId || hasStatus;
    };

    // Filter leads by search query and current active role tab
    const getFilteredSlots = () => {
        return leads.filter(l => {
            const textMatch = searchQuery === '' ||
                l.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (l.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (l.contact_number || '').includes(searchQuery);

            if (!textMatch) return false;

            if (activeTab === 'mmt') {
                return isMmtLead(l);
            } else if (activeTab === 'site_inspector') {
                return isSiteInspectorLead(l);
            } else if (activeTab === 'associate_designer') {
                return isDesignerLead(l);
            } else if (activeTab === 'pm') {
                return isPmLead(l);
            }
            return true;
        });
    };

    const currentSlots = getFilteredSlots();

    const tabsConfig = [
        { id: 'mmt', label: '📦 MMT (Masking Team)', count: leads.filter(isMmtLead).length, isLocked: false },
        { id: 'site_inspector', label: isQcTabUnlocked ? '🔍 Site Inspector' : '🔒 QC Inspector (Requires 20% Paid)', count: leads.filter(isSiteInspectorLead).length, isLocked: !isQcTabUnlocked },
        { id: 'associate_designer', label: '🎨 Associate Designer', count: leads.filter(isDesignerLead).length, isLocked: false },
        { id: 'pm', label: '🏢 Project Manager', count: leads.filter(isPmLead).length, isLocked: false },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            
            {/* Header & Role Navigation Bar */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={22} color="#ea580c" /> Site &amp; Masking Slot Bookings
                        </h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                            Multi-role personnel assignment and scheduled slot management across site teams.
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative', width: '240px' }}>
                            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search client or site..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                            />
                        </div>
                        <button
                            onClick={fetchBookedSlots}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.80rem' }}
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {/* 4 ROLE TABS (MMT, Site Inspector, Associate Designer, Project Manager) */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #f1f5f9', paddingBottom: '2px' }}>
                    {tabsConfig.map(tab => {
                        const isActive = activeTab === tab.id;
                        const locked = tab.isLocked;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    if (locked) {
                                        if (onRequirePayment) onRequirePayment();
                                    } else {
                                        setActiveTab(tab.id as any);
                                    }
                                }}
                                title={locked ? 'Click to Record Stage 2 (20% Cumulative Payment) to unlock Quality Check Inspector' : ''}
                                style={{
                                    padding: '10px 16px',
                                    border: 'none',
                                    borderBottom: isActive ? '3px solid #ea580c' : '3px solid transparent',
                                    backgroundColor: locked ? '#fff1f2' : isActive ? '#fff7ed' : 'transparent',
                                    color: locked ? '#e11d48' : isActive ? '#ea580c' : '#64748b',
                                    fontWeight: isActive || locked ? 800 : 600,
                                    fontSize: '0.86rem',
                                    borderRadius: '8px 8px 0 0',
                                    cursor: 'pointer',
                                    opacity: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab.label}
                                <span style={{
                                    backgroundColor: isActive ? '#ea580c' : '#e2e8f0',
                                    color: isActive ? '#ffffff' : '#475569',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800
                                }}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Booked Slots List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading slot bookings...
                </div>
            ) : currentSlots.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                    <AlertCircle size={32} color="#94a3b8" style={{ marginBottom: '10px' }} />
                    <h3 style={{ margin: '0 0 4px 0', color: '#334155', fontSize: '1rem', fontWeight: 700 }}>
                        No {activeTab.replace('_', ' ').toUpperCase()} Booked Slots Found
                    </h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.84rem' }}>
                        Booked slots for this role will appear here automatically when assigned.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
                    {currentSlots.map(slot => {
                        const bookingTime = activeTab === 'site_inspector'
                            ? (slot.site_manager_booking_time || (slot as any).qc_booking_time)
                            : activeTab === 'mmt'
                            ? slot.mmts_booking_time
                            : activeTab === 'pm'
                            ? (slot.site_manager_booking_time || slot.d1_booking_time)
                            : (slot.d1_booking_time || slot.site_manager_booking_time || slot.mmts_booking_time);
                        const formattedTime = bookingTime ? new Date(bookingTime).toLocaleString('en-IN', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'Time Slot Confirmed';

                        return (
                            <div
                                key={slot.lead_id}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    padding: '18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                            >
                                <div>
                                    {/* Top Slot Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                                                DC-{slot.lead_id}
                                            </span>
                                            <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                                {slot.client_name}
                                            </h3>
                                            {slot.location && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#64748b' }}>
                                                    <MapPin size={12} color="#94a3b8" /> {slot.location}
                                                </div>
                                            )}
                                        </div>
                                        <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7', padding: '3px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <CheckCircle2 size={12} /> Confirmed Slot
                                        </span>
                                    </div>

                                    {/* Scheduled Date & Time Bar */}
                                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                        <Clock size={16} color="#ea580c" />
                                        <div>
                                            <div style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Scheduled Slot Time</div>
                                            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>{formattedTime}</div>
                                        </div>
                                    </div>

                                    {/* Assigned Personnel Grid for All 4 Roles */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', backgroundColor: '#fafafa', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '0.76rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>📦 MMT Team:</span>
                                            <strong style={{ color: slot.mmt_assigned_name ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                                                {slot.mmt_assigned_name || 'Not assigned'}
                                            </strong>
                                        </div>
                                        <div style={{ fontSize: '0.76rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>🔍 Site Inspector:</span>
                                            <strong style={{ color: slot.site_inspector_assigned_name ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                                                {slot.site_inspector_assigned_name || slot.site_manager_assigned_to || 'Not assigned'}
                                            </strong>
                                        </div>
                                        <div style={{ fontSize: '0.76rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>🎨 Associate Designer:</span>
                                            <strong style={{ color: slot.associate_designer_assigned_name ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                                                {slot.associate_designer_assigned_name || slot.d1_assigned_to || 'Not assigned'}
                                            </strong>
                                        </div>
                                        <div style={{ fontSize: '0.76rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>🏢 Project Manager:</span>
                                            <strong style={{ color: slot.pm_assigned_name ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                                                {slot.pm_assigned_name || 'Not assigned'}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Slot Notes / Instructions */}
                                    {(() => {
                                        const noteText = activeTab === 'site_inspector'
                                            ? (slot.site_manager_notes || (slot as any).qc_notes)
                                            : activeTab === 'mmt'
                                            ? slot.mmts_notes
                                            : activeTab === 'pm'
                                            ? slot.site_manager_notes
                                            : (slot.d1_notes || slot.site_manager_notes || slot.mmts_notes);
                                        if (!noteText) return null;
                                        return (
                                            <div style={{ fontSize: '0.78rem', color: '#475569', backgroundColor: '#fff7ed', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid #ea580c', marginBottom: '14px' }}>
                                                <strong>Note:</strong> {noteText}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Bottom Contact & Action Bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                    {slot.contact_number ? (
                                        <a href={`tel:${slot.contact_number}`} style={{ textDecoration: 'none', color: '#2563eb', fontSize: '0.80rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Phone size={13} /> {slot.contact_number}
                                        </a>
                                    ) : (
                                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No contact</span>
                                    )}

                                    {/* Action Button for MMTS / QC Inspector / Personnel Meeting */}
                                    {(() => {
                                        const roleStatus = activeTab === 'mmt'
                                            ? (slot.mmts_status || '')
                                            : activeTab === 'site_inspector'
                                            ? (slot.qc_status || slot.site_inspector_status || slot.site_manager_status || '')
                                            : activeTab === 'associate_designer'
                                            ? (slot.d1_status || '')
                                            : (slot.status || '');

                                        const st = (roleStatus || '').toLowerCase();
                                        const isInMeeting = st === 'in_meeting' || st === 'started';
                                        const isDone = st === 'meeting_completed' || st === 'completed';

                                        if (isInMeeting) {
                                            return (
                                                <button
                                                    onClick={async () => {
                                                        if (activeTab === 'mmt') {
                                                            setLeads(prev => prev.map(l => l.lead_id === slot.lead_id ? { ...l, mmts_status: 'meeting_completed' } : l));
                                                            await axios.post(`${API_BASE_URL}/leads/update-mmts-status`, { lead_id: slot.lead_id, status: 'meeting_completed', assigned_by_name: user?.name || 'User' }).catch(() => {});
                                                        } else if (activeTab === 'site_inspector') {
                                                            setLeads(prev => prev.map(l => l.lead_id === slot.lead_id ? { ...l, qc_status: 'meeting_completed', site_inspector_status: 'meeting_completed' } : l));
                                                            await axios.post(`${API_BASE_URL}/leads/update-qc-status`, { lead_id: slot.lead_id, status: 'meeting_completed', assigned_by_name: user?.name || 'User' }).catch(() => {});
                                                        } else {
                                                            setLeads(prev => prev.map(l => l.lead_id === slot.lead_id ? { ...l, status: 'meeting_completed', d1_status: 'meeting_completed' } : l));
                                                            await axios.post(`${API_BASE_URL}/leads/update-status`, { lead_id: slot.lead_id, status: 'meeting_completed' }).catch(() => {});
                                                        }
                                                        fetchBookedSlots();
                                                    }}
                                                    style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)' }}
                                                >
                                                    <CheckCircle2 size={14} /> End Meeting
                                                </button>
                                            );
                                        } else if (!isDone) {
                                            return (
                                                <button
                                                    onClick={async () => {
                                                        if (activeTab === 'mmt') {
                                                            setLeads(prev => prev.map(l => l.lead_id === slot.lead_id ? { ...l, mmts_status: 'in_meeting' } : l));
                                                            await axios.post(`${API_BASE_URL}/leads/update-mmts-status`, { lead_id: slot.lead_id, status: 'in_meeting', assigned_by_name: user?.name || 'User' }).catch(() => {});
                                                        } else if (activeTab === 'site_inspector') {
                                                            setLeads(prev => prev.map(l => l.lead_id === slot.lead_id ? { ...l, qc_status: 'in_meeting', site_inspector_status: 'in_meeting' } : l));
                                                            await axios.post(`${API_BASE_URL}/leads/update-qc-status`, { lead_id: slot.lead_id, status: 'in_meeting', assigned_by_name: user?.name || 'User' }).catch(() => {});
                                                        } else {
                                                            setLeads(prev => prev.map(l => l.lead_id === slot.lead_id ? { ...l, status: 'in_meeting', d1_status: 'in_meeting' } : l));
                                                            await axios.post(`${API_BASE_URL}/leads/update-status`, { lead_id: slot.lead_id, status: 'in_meeting' }).catch(() => {});
                                                        }
                                                        fetchBookedSlots();
                                                    }}
                                                    style={{ backgroundColor: '#ea580c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)' }}
                                                >
                                                    <Play size={14} fill="white" /> Start Meeting
                                                </button>
                                            );
                                        } else {
                                            return (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                                    ✅ Meeting Done
                                                </span>
                                            );
                                        }
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
