
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

function App() {
  return (
    <TooltipProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/clients/:clientId" element={<AdminClientPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
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
