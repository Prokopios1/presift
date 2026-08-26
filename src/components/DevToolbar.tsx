import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export const DevToolbar = () => {
  const [loading, setLoading] = useState(false);
  const isSubmitting = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Dev/test-only test kit. In production builds this guard is constant-folded
  // by the bundler and the entire toolbar is dropped from the bundle. The old
  // `?demo=true` escape hatch is removed — production can never show this
  // toolbar or reach its seeder / mock-login / auto-submit buttons.
  if (import.meta.env.MODE === 'production') return null;

  const isPublicRoute = location.pathname === '/' || location.pathname === '/pricing';

  if (isPublicRoute) return null;

  const handleMockRecruiterLogin = () => {
    alert("Mock login is disabled in strict auth mode. Please use the Firebase Emulator Auth UI.");
  };

  const handleMockAdminLogin = () => {
    alert("Mock login is disabled in strict auth mode. Please use the Firebase Emulator Auth UI.");
  };

  const handleSeedData = async () => {
    setLoading(true);
    try {
      const seedDemoData = httpsCallable(functions, 'seedDemoData');
      await seedDemoData();
      navigate('/dashboard');
      window.location.reload();
    } catch (e) {
      console.error("Failed to seed data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleInstantSubmit = async () => {
    const match = location.pathname.match(/\/(test|assessment)\/([^/]+)/);
    const assessmentId = match ? match[2] : null;
    if (!assessmentId) return;

    const savedSession = localStorage.getItem(`assessment_${assessmentId}_sessionData`);
    if (!savedSession) {
      alert("No session — please reload the test page first.");
      return;
    }
    
    if (isSubmitting.current) return;
    
    setLoading(true);
    isSubmitting.current = true;
    try {
      const sessionData = JSON.parse(savedSession);
      const icar = sessionData.items.map((i: any) => ({
        itemId: i.itemId,
        selectedIndex: Math.floor(Math.random() * 4),
      }));
      const wleis = sessionData.wleisItems.map((i: any) => ({
        itemId: i.itemId,
        value: Math.floor(Math.random() * 7) + 1,
      }));

      const submitAssessment = httpsCallable(functions, 'submitAssessment');
      await submitAssessment({ sessionId: sessionData.sessionId, icar, wleis });
      alert("Auto-Submitted!");
      navigate('/');
    } catch (e) {
      console.error("Auto-submit failed", e);
      isSubmitting.current = false;
    } finally {
      setLoading(false);
    }
  };

  const isTestPage = location.pathname.includes('/test/') || location.pathname.includes('/assessment/');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-2 flex items-center justify-between z-50 text-xs border-t border-red-600/50">
      <div className="font-bold flex items-center gap-2">
        <span className="bg-red-600 px-2 py-1 rounded text-[10px] uppercase tracking-wider animate-pulse">Dev Mode</span>
        PreSift Test Kit
      </div>
      <div className="flex gap-2">
        {!isTestPage && (
          <>
            <Button size="sm" variant="secondary" onClick={handleMockRecruiterLogin}>🧑‍💼 Recruiter Login</Button>
            <Button size="sm" variant="secondary" onClick={handleMockAdminLogin}>👑 Admin Login</Button>
            <Button size="sm" variant="secondary" onClick={handleSeedData} disabled={loading}>
              {loading ? "Seeding..." : "🌱 Seed Demo Data"}
            </Button>
          </>
        )}
        {isTestPage && (
          <Button size="sm" variant="destructive" onClick={handleInstantSubmit} disabled={loading}>
            ⚡ Auto-Fill & Submit Test
          </Button>
        )}
      </div>
    </div>
  );
};
