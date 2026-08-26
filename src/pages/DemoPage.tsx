import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { ThemeToggle } from '@/components/ThemeToggle';

export const DemoPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRecruiterLogin = () => {
    alert("Mock login is disabled in strict auth mode. Please use the Firebase Emulator Auth UI.");
  };

  const handleAdminLogin = () => {
    alert("Mock login is disabled in strict auth mode. Please use the Firebase Emulator Auth UI.");
  };

  const handleSeed = async () => {
    setLoading(true);
    try {
      const seedDemoData = httpsCallable(functions, 'seedDemoData');
      await seedDemoData();
      alert("Seeded 9 candidates + recruiter + admin accounts!");
      navigate('/dashboard');
    } catch (e) {
      console.error("Seed failed:", e);
      alert("Seeding failed — is the emulator running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Badge className="bg-red-100 text-red-700 border-none">Development Only</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Dev Mode Test Kit</h1>
            <p className="text-slate-500">Instantly bootstrap test data and bypass authentication.</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🧑‍💼 One-Click Login Bypass</CardTitle>
              <CardDescription>Load mock sessions without Firebase Auth.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={handleRecruiterLogin} className="flex-1">Load Mock Recruiter Session</Button>
              <Button onClick={handleAdminLogin} variant="outline" className="flex-1">Load Mock Admin Session</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🌱 Database Seeder</CardTitle>
              <CardDescription>Generate 9 realistic candidate records with pre-calculated scores.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSeed} disabled={loading} className="w-full" variant="secondary">
                {loading ? "Seeding Firestore..." : "Seed Demo Data (9 Candidates)"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">⚡ Instant Candidate Simulator</CardTitle>
              <CardDescription>Available on /test/:assessmentId pages via the DevToolbar.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Navigate to any assessment link and use the "Auto-Fill & Submit Test" button in the bottom toolbar.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
