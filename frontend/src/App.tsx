import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TeamManagement } from './pages/TeamManagement';
import { Leads } from './pages/Leads';
import { Clients } from './pages/Clients';
import { Projects } from './pages/Projects';
import { Inventory } from './pages/Inventory';
import { Finance } from './pages/Finance';
import Agreements from "./pages/Agreements";
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import Timeline from './pages/Timeline';

import { ProjectDetails } from './pages/ProjectDetails';
import { QuotesPage } from './pages/QuotesPage';
import { Vendors } from './pages/Vendors';
import { GlobalVendors } from './pages/GlobalVendors';

const AppContent = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/global-vendors" element={<GlobalVendors />} />
        <Route path="/finance" element={<Finance />} />
        <Route path='/timeline' element={<Timeline/>} />
        <Route path="/agreements" element={<Agreements />} />
        <Route path="/quotes" element={<QuotesPage />} />
        {(user?.role === 'principal_architect' || user?.role === 'admin') && (
          <Route path="/team" element={<TeamManagement />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
