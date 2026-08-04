import React from 'react';
import { BarChart3, PieChart, TrendingUp, Activity } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const AnalysisSection: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Analysis Section</h2>
                <p style={{ color: '#6b7280' }}>Detailed insights and performance analysis for {user?.name}.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '2px' }}>Project Completion Rate</p>
                        <h4 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2937' }}>--%</h4>
                    </div>
                </div>

                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#10b98115', color: '#10b981' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '2px' }}>Revenue Growth</p>
                        <h4 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2937' }}>--%</h4>
                    </div>
                </div>

                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#f59e0b15', color: '#f59e0b' }}>
                        <PieChart size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '2px' }}>Lead Conversion</p>
                        <h4 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2937' }}>--%</h4>
                    </div>
                </div>

                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#ef444415', color: '#ef4444' }}>
                        <Activity size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '2px' }}>Overall Efficiency</p>
                        <h4 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2937' }}>--</h4>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '20px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Detailed Analytics (Placeholder)</h3>
                </div>
                <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                    <p style={{ color: '#6b7280' }}>Charts and detailed reports will be displayed here.</p>
                </div>
            </div>
        </div>
    );
};
