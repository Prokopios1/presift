import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Identity: the logged-in recruiter's uid — same source as the route guards in
// App.tsx. Read at call time so fresh registrations/session switches take
// effect without a reload.
const getRecruiterId = () => localStorage.getItem('presift_uid') || '';

export const CampaignsPage = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const uid = getRecruiterId();
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'campaigns'),
          where('recruiterId', '==', uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCampaigns(list);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
        <nav className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 sticky top-0 z-40 px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
          <ThemeToggle />
        </nav>
        
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Assessment Campaigns</h1>
              <p className="text-slate-500">Manage your hiring campaigns and view their overall status.</p>
            </div>
            <Button onClick={() => navigate('/assessments/new')}>
              <Plus className="w-4 h-4 mr-2" /> New Assessment Campaign
            </Button>
          </header>

          {loading ? (
            <div className="text-slate-500">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <h2 className="text-xl font-semibold mb-2">No campaigns yet</h2>
              <p className="text-slate-500 mb-6">Create your first assessment campaign to start evaluating candidates.</p>
              <Button onClick={() => navigate('/assessments/new')}>
                <Plus className="w-4 h-4 mr-2" /> Create Campaign
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map(c => (
                <Card key={c.id} className="flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/dashboard')}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{c.positionTitle}</CardTitle>
                        {c.department && <CardDescription>{c.department}</CardDescription>}
                      </div>
                      <Badge variant={c.status === 'open' ? 'default' : 'secondary'}>
                        {c.status === 'open' ? 'Active' : 'Closed'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Modules</p>
                        <div className="flex flex-wrap gap-2">
                          {c.moduleIds?.map((mod: string) => (
                            <Badge key={mod} variant="outline" className="bg-slate-50 dark:bg-slate-800">
                              {mod === 'icar16' ? 'ICAR-16 (Cognitive)' : mod === 'wleis16' ? 'WLEIS-16 (EQ)' : mod}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t bg-slate-50/50 dark:bg-slate-900/50 py-3">
                    <div className="w-full flex justify-between items-center text-sm">
                      <span className="text-slate-500">Candidates invited:</span>
                      <span className="font-semibold">{c.candidateCount || 0}</span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
