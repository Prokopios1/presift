
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { PaymentPage } from './pages/PaymentPage';
import { DashboardPage } from './pages/DashboardPage';
import { TestPage } from './pages/TestPage';
import { DemoPage } from './pages/DemoPage';
import { AdminPage } from './pages/AdminPage';
import { DevToolbar } from './components/DevToolbar';

import { ThemeToggle } from './components/ThemeToggle';

function App() {
  return (
    <Router>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/test/:assessmentId" element={<TestPage />} />
        <Route path="/assessment/:assessmentId" element={<TestPage />} />
        <Route path="/demo" element={<DemoPage />} />
          <Route path="/pricing" element={<PaymentPage />} />
      </Routes>
      <DevToolbar />
    </Router>
  );
}

export default App;
