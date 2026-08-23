import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { doc, getDoc } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export const CandidateDetailPage = () => {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCandidate = async () => {
      if (!candidateId) return;
      try {
        const docRef = doc(db, 'candidates', candidateId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSelectedCandidate({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.error("No such candidate!");
        }
      } catch (e) {
        console.error("Error fetching candidate:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchCandidate();
  }, [candidateId]);

  const updateStatus = async (status: string) => {
    if (!selectedCandidate) return;
    try {
      const updateCandidateStatus = httpsCallable(functions, 'updateCandidateStatus');
      await updateCandidateStatus({ candidateId: selectedCandidate.id, status });
      setSelectedCandidate({ ...selectedCandidate, status });
    } catch (e) {
      alert('Failed to update status');
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this candidate (GDPR)? This cannot be undone.')) {
      try {
        const deleteCandidate = httpsCallable(functions, 'deleteCandidate');
        await deleteCandidate({ candidateId: id });
        navigate('/dashboard');
      } catch (e) {
        alert('Failed to delete candidate.');
        console.error(e);
      }
    }
  };

  const getDynamicPrompts = (c: any) => {
    if (!c?.scoreResult?.wleis?.rawScores) return [];
    const { SEA = 0, OEA = 0, UOE = 0, ROE = 0 } = c.scoreResult.wleis.rawScores;
    let prompts = [];
    if (SEA < 20) prompts.push('Can you describe a time you felt overwhelmed and how you recognized it?');
    if (OEA < 20) prompts.push('Tell me about a situation where you had to read the room and adjust your approach.');
    if (UOE < 20) prompts.push('Describe a time when you motivated yourself to complete a tedious task.');
    if (ROE < 20) prompts.push('How do you handle working with someone who is extremely stressed or frustrated?');
    if (c.scoreResult?.icar?.percentile < 30) prompts.push('Can you walk me through your step-by-step process for solving a completely new problem?');
    if (prompts.length === 0) {
      prompts.push('Your scores indicate balanced emotional intelligence and cognitive skills. How do you plan to leverage these strengths in this role?');
    }
    return prompts.slice(0, 3);
  };

  if (loading) return <div className="p-8 text-center">Loading candidate...</div>;
  if (!selectedCandidate) return <div className="p-8 text-center">Candidate not found.</div>;

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
        
        <div className="p-8 max-w-4xl mx-auto space-y-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">{selectedCandidate.name}</h1>
            <p className="text-slate-500">{selectedCandidate.roleTitle || selectedCandidate.appliedRole} • {selectedCandidate.status}</p>
          </div>

          <div className="flex gap-4 items-center">
            <Badge className="text-lg py-1 px-3" variant="secondary">{selectedCandidate.fitBadge || selectedCandidate.fit}</Badge>
            {selectedCandidate.integrityEvents?.length > 0 && (
              <Badge variant="destructive" className="text-lg py-1 px-3">⚠️ {selectedCandidate.integrityEvents.length} Integrity Flags</Badge>
            )}
            
            <div className="ml-auto flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant={selectedCandidate.status === 'Shortlisted' ? 'default' : 'outline'} onClick={() => updateStatus('Shortlisted')}>Shortlist</Button>
                </TooltipTrigger>
                <TooltipContent>Move to Shortlisted status</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant={selectedCandidate.status === 'Interviewing' ? 'default' : 'outline'} onClick={() => updateStatus('Interviewing')}>Interview</Button>
                </TooltipTrigger>
                <TooltipContent>Move to Interviewing status</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant={selectedCandidate.status === 'Rejected' ? 'default' : 'outline'} onClick={() => updateStatus('Rejected')}>Reject</Button>
                </TooltipTrigger>
                <TooltipContent>Move to Rejected status</TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-slate-500">Cognitive (ICAR)</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{selectedCandidate.scoreResult?.icar?.percentile || 0}th <span className="text-sm font-normal text-slate-500">%ile</span></p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-slate-500">Emotional Intelligence</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{selectedCandidate.scoreResult?.wleis?.rawScores?.Total || 0} <span className="text-sm font-normal text-slate-500">Score</span></p></CardContent>
            </Card>
          </div>

          {selectedCandidate.scoreResult && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">ICAR 4-Domain Breakdown</h3>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.icar?.domainScores?.numerical ?? 'N/A'}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Numerical</div>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.icar?.domainScores?.verbal ?? 'N/A'}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Verbal</div>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.icar?.domainScores?.abstract ?? 'N/A'}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Abstract</div>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.icar?.domainScores?.spatial ?? 'N/A'}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Spatial</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg">WLEIS 4x4 Breakdown</h3>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.wleis?.rawScores?.SEA || 0}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Self</div>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.wleis?.rawScores?.OEA || 0}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Others</div>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.wleis?.rawScores?.UOE || 0}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Use</div>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    <div className="font-bold">{selectedCandidate.scoreResult.wleis?.rawScores?.ROE || 0}</div>
                    <div className="text-slate-500 text-[10px] uppercase">Reg</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Anti-Cheating Summary */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Anti-Cheating Logs</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{selectedCandidate.duration ? `${Math.round(selectedCandidate.duration / 60)}m ${selectedCandidate.duration % 60}s` : 'N/A'}</p>
                  <p className="text-xs text-slate-500 uppercase mt-1">Total Duration</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${(selectedCandidate.integrityEvents?.length || 0) > 2 ? 'text-red-500' : ''}`}>{selectedCandidate.integrityEvents?.length || 0}</p>
                  <p className="text-xs text-slate-500 uppercase mt-1">Tab-Switch Blurs</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Custom Interview Prompts</h3>
            <Card className="bg-slate-50 dark:bg-slate-900/50">
              <CardContent className="p-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {getDynamicPrompts(selectedCandidate).map((p, i) => (
                  <p key={i}>{i + 1}. "{p}"</p>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4 pt-4 border-t mt-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="flex-1" onClick={() => window.print()}>Export PDF</Button>
              </TooltipTrigger>
              <TooltipContent>Print or save this candidate report as PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" className="flex-1" onClick={() => handleDelete(selectedCandidate.id)}>Delete Data (GDPR)</Button>
              </TooltipTrigger>
              <TooltipContent>Permanently delete all candidate data (GDPR hard delete)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </main>
    </div>
  );
};
