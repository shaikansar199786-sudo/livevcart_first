import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

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
import VendorQuotaPage from './pages/VendorQuotaPage';
import { ProjectTrackers } from './pages/ProjectTrackers';
import { MonthlyIncome } from './pages/MonthlyIncome';
import { TeamWorkLoad } from './pages/TeamWorkLoad';
import { D1Dashboard } from './pages/D1Dashboard';
import { D1Leads } from './pages/D1Leads';
import { FinancialOverview } from './pages/FinancialOverview';
import { CompanyExpenses } from './pages/CompanyExpenses';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { AnalysisSection } from './pages/AnalysisSection';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { GDDashboard } from './pages/GDDashboard';
import { GDTasks } from './pages/GDTasks';
import { AdminGDTasks } from './pages/AdminGDTasks';
import { LivincartProjectTimelines } from './pages/LivincartProjectTimelines';
import { Reports } from './pages/Reports';
import Reimbursements from './pages/Reimbursements';
import StaffReimbursements from './pages/StaffReimbursements';
import { MBDashboard } from './pages/MBDashboard';
import { MBTasks } from './pages/MBTasks';
import { AdminTasksPage } from './pages/AdminTasksPage';
import PrintQuoteView from './pages/PrintQuoteView';
import PrintAgreementView from './pages/PrintAgreementView';
import PrintVendorQuotaView from './pages/PrintVendorQuotaView';
import PrintMomView from './pages/PrintMomView';
import { PmDashboard } from './pages/PmDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { AccountantDashboard } from './pages/AccountantDashboard';
import { DesignerDashboard } from './pages/DesignerDashboard';
import { MarketingDashboard } from './pages/MarketingDashboard';
import { MmtDashboard } from './pages/MmtDashboard';
import { SiteDashboard } from './pages/SiteDashboard';
import { MmtLeadsPage } from './pages/MmtLeadsPage';
import { SiteLeadsPage } from './pages/SiteLeadsPage';

const AppContent = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Unauthenticated print routes — for Puppeteer PDF generation only */}
        <Route path="/print-quote/:quoteId" element={<PrintQuoteView />} />
        <Route path="/print-agreement/:agreementId" element={<PrintAgreementView />} />
        <Route path="/print-vendor-quota" element={<PrintVendorQuotaView />} />
        <Route path="/print-mom/:projectId" element={<PrintMomView />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const getHomeElement = () => {
    const r = String(user?.role || '').toLowerCase();
    if (r.includes('graphic') || r === 'gd') return <Navigate to="/gd-dashboard" replace />;
    if (r === 'd1' || r === 'd2') return <Navigate to="/d1-dashboard" replace />;
    if (r === 'business_associate') return <Navigate to="/mb-dashboard" replace />;
    if (r === 'project_manager') return <Navigate to="/pm-dashboard" replace />;
    if (r === 'manager') return <Navigate to="/manager-dashboard" replace />;
    if (r === 'accountant') return <Navigate to="/accountant-dashboard" replace />;
    if (r === 'associate_designer') return <Navigate to="/designer-dashboard" replace />;
    if (r === 'marketing_analyst') return <Navigate to="/marketing-dashboard" replace />;
    if (r === 'mmt') return <Navigate to="/mmt-dashboard" replace />;
    if (r === 'site_engineer' || r === 'site_inspector' || r === 'site_inspection') return <Navigate to="/site-dashboard" replace />;
    if (r === 'sales') return <Navigate to="/dashboard" replace />;
    if (r === 'admin') return <Navigate to="/overview" replace />;
    return <Navigate to="/dashboard" replace />;
  };

  return (
    <Routes>
      {/* Standalone print routes — rendered clean without sidebar layout or grey padding */}
      <Route path="/print-quote/:quoteId" element={<PrintQuoteView />} />
      <Route path="/print-agreement/:agreementId" element={<PrintAgreementView />} />
      <Route path="/print-vendor-quota" element={<PrintVendorQuotaView />} />
      <Route path="/print-mom/:projectId" element={<PrintMomView />} />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={getHomeElement()} />
              <Route path="/team-targets" element={<Navigate to="/" replace />} />
              {user?.role === 'admin' && (
                <Route path="/financial-overview" element={<FinancialOverview />} />
              )}
              {user?.role === 'admin' && (
                <Route path="/team-work-load" element={<TeamWorkLoad />} />
              )}
              {user?.role === 'admin' && (
                <Route path="/admin-tasks" element={<AdminTasksPage />} />
              )}

              <Route path="/gd-dashboard" element={<GDDashboard />} />
              <Route path="/gd-tasks" element={<GDTasks />} />
              <Route path="/admin-gd-tasks" element={<AdminGDTasks />} />
              <Route path="/d1-dashboard" element={<D1Dashboard />} />
              <Route path="/d1-leads" element={<D1Leads />} />
              <Route path="/mb-dashboard" element={<MBDashboard />} />
              <Route path="/mb-tasks" element={<MBTasks />} />
              <Route path="/overview" element={<OverviewDashboard />} />
              <Route path="/pm-dashboard" element={<PmDashboard />} />
              <Route path="/manager-dashboard" element={<ManagerDashboard />} />
              <Route path="/accountant-dashboard" element={<AccountantDashboard />} />
              <Route path="/designer-dashboard" element={<DesignerDashboard />} />
              <Route path="/marketing-dashboard" element={<MarketingDashboard />} />
              <Route path="/mmt-dashboard" element={<MmtDashboard />} />
              <Route path="/mmt-leads" element={<MmtLeadsPage />} />
              <Route path="/site-dashboard" element={<SiteDashboard />} />
              <Route path="/site-leads" element={<SiteLeadsPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              {user?.role !== 'admin' && (
                <Route path="/analysis" element={<AnalysisSection />} />
              )}
              <Route path="/reports" element={<Reports />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/global-vendors" element={<GlobalVendors />} />
              <Route path="/finance" element={<Finance />} />
              <Route path='/timeline' element={<Timeline />} />
              <Route path='/project-timelines' element={<LivincartProjectTimelines />} />
              <Route path="/agreements" element={<Agreements />} />
              <Route path="/quotes" element={<QuotesPage />} />
              <Route path="/vendor-quota" element={<VendorQuotaPage />} />

              {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'project_manager') && (
                <Route path="/team" element={<TeamManagement />} />
              )}
              {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'project_manager') && (
                <Route path="/company-expenses" element={<CompanyExpenses />} />
              )}
              {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'project_manager') && (
                <Route path="/staff-reimbursements" element={<StaffReimbursements />} />
              )}

              <Route path="/reimbursements" element={<Reimbursements />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
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
