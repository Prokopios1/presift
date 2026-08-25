import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';

import { LandingPage } from './pages/LandingPage';
import { PaymentPage } from './pages/PaymentPage';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { AssessmentWizardPage } from './pages/AssessmentWizardPage';
import { TestPage } from './pages/TestPage';
import { DemoPage } from './pages/DemoPage';
import { AdminPage } from './pages/AdminPage';
import { AdminClientPage } from './pages/AdminClientPage';
import { DevToolbar } from './components/DevToolbar';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { TooltipProvider } from './components/ui/tooltip';
import { CandidateDetailPage } from './pages/CandidateDetailPage';
import { ProfilePage } from './pages/ProfilePage';
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Checking access...</div>;
  if (role !== 'admin' && role !== 'owner') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const RecruiterGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Checking access...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'admin' || role === 'owner') return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <ImpersonationProvider>
          <Router>
            <ImpersonationBanner />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
              <Route path="/admin/clients/:clientId" element={<AdminGuard><AdminClientPage /></AdminGuard>} />
              <Route path="/dashboard" element={<RecruiterGuard><DashboardPage /></RecruiterGuard>} />
              <Route path="/profile" element={<RecruiterGuard><ProfilePage /></RecruiterGuard>} />
              <Route path="/assessments" element={<RecruiterGuard><CampaignsPage /></RecruiterGuard>} />
              <Route path="/assessments/new" element={<RecruiterGuard><AssessmentWizardPage /></RecruiterGuard>} />
              <Route path="/candidate/:candidateId" element={<CandidateDetailPage />} />
              <Route path="/test/:assessmentId" element={<TestPage />} />
              <Route path="/assessment/:assessmentId" element={<TestPage />} />
              {import.meta.env.MODE !== 'production' && <Route path="/demo" element={<DemoPage />} />}
              <Route path="/pricing" element={<PaymentPage />} />
            </Routes>
            <DevToolbar />
          </Router>
        </ImpersonationProvider>
      </AuthProvider>
    </TooltipProvider>
  );
}

export default App;
