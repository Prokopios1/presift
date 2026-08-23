
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { PaymentPage } from './pages/PaymentPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TestPage } from './pages/TestPage';
import { DemoPage } from './pages/DemoPage';
import { AdminPage } from './pages/AdminPage';
import { AdminClientPage } from './pages/AdminClientPage';
import { DevToolbar } from './components/DevToolbar';
import { TooltipProvider } from './components/ui/tooltip';
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { CandidateDetailPage } from './pages/CandidateDetailPage';

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const uid = localStorage.getItem('presift_uid');
        if (uid) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            setRole(userDoc.data()?.role || 'recruiter');
            setLoading(false);
            return;
          }
        }
        
        const demoSession = localStorage.getItem('presift_demo_session');
        if (demoSession) {
          const parsed = JSON.parse(demoSession);
          setRole(parsed.role || 'recruiter');
        }
      } catch (err) {
        console.error('Role check failed:', err);
      } finally {
        setLoading(false);
      }
    };
    checkRole();
  }, []);

  if (loading) return <div className="p-8 text-center">Checking access...</div>;
  if (role !== 'admin' && role !== 'owner') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <TooltipProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
          <Route path="/admin/clients/:clientId" element={<AdminGuard><AdminClientPage /></AdminGuard>} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/candidate/:candidateId" element={<CandidateDetailPage />} />
          <Route path="/test/:assessmentId" element={<TestPage />} />
          <Route path="/assessment/:assessmentId" element={<TestPage />} />
          {import.meta.env.MODE !== 'production' && <Route path="/demo" element={<DemoPage />} />}
          <Route path="/pricing" element={<PaymentPage />} />

        </Routes>
        <DevToolbar />
      </Router>
    </TooltipProvider>
  );
}

export default App;
