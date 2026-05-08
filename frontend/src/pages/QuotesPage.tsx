import React from 'react';
import QuoteTab from '../components/QuoteTab';
import { useAuth } from '../hooks/useAuth';

export const QuotesPage: React.FC = () => {
    const { user } = useAuth();
    
    // Standalone quotes don't have a project context, 
    // so we pass a dummy project object.
    const dummyProject = {
        project_id: 'standalone',
        project_name: 'New Estimation'
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Estimation Tool</h2>
                <p style={{ color: '#64748b' }}>Create and manage financial quotes. Use the undo/redo buttons to track your changes.</p>
            </div>
            
            <QuoteTab 
                project={dummyProject} 
                user={user} 
                isReadOnly={false} 
                isUsedQuote={false}
                hideSave={true} // Hide save button for now as it needs a real project_id
            />
            
            <div className="no-print" style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>Note:</h4>
                <ul style={{ color: '#64748b', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>This estimation tool is for quick calculations.</li>
                    <li>To save a quote permanently, please go to a specific project and use the Quote tab there.</li>
                    <li>You can print this estimate using the "Print Quote" button above.</li>
                </ul>
            </div>
        </div>
    );
};
