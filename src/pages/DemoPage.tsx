import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export const DemoPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRecruiterLogin = () => {
    localStorage.setItem('presift_demo_session', JSON.stringify({
      email: 'demo_recruiter@presift.app', role: 'recruiter', credits: 5,
      vatId: 'DE123456789', companyName: 'Acme Corp (Demo)',
      assessments: ['/assessment/demo1', '/assessment/demo2', '/assessment/demo3'],
    }));
    localStorage.setItem('presift_uid', 'demo_recruiter');
    navigate('/dashboard');
  };

  const handleOwnerLogin = () => {
    localStorage.setItem('presift_demo_session', JSON.stringify({
      email: 'prokopios@presift.app', role: 'admin', credits: 999, companyName: 'PreSift Admin',
    }));
    localStorage.setItem('presift_uid', 'owner_prokopios');
    navigate('/admin');
  };

  const handleSeed = async () => {
    setLoading(true);
    try {
      const seedDemoData = httpsCallable(functions, 'seedDemoData');
      await seedDemoData();
      alert("Seeded 9 candidates + recruiter + owner accounts!");
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
        <div className="space-y-2">
          <Badge className="bg-red-100 text-red-700 border-none">Development Only</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Dev Mode Test Kit</h1>
          <p className="text-slate-500">Instantly bootstrap test data and bypass authentication.</p>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🧑‍💼 One-Click Login Bypass</CardTitle>
              <CardDescription>Load mock sessions without Firebase Auth.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={handleRecruiterLogin} className="flex-1">Load Mock Recruiter Session</Button>
              <Button onClick={handleOwnerLogin} variant="outline" className="flex-1">Load Mock Owner Session</Button>
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
