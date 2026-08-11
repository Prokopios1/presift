import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppSidebar } from '@/components/AppSidebar';

import { useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const RECRUITER_ID = 'demo_recruiter';

export const DashboardPage = () => {
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createLinkDialogOpen, setCreateLinkDialogOpen] = useState(false);

  const filteredCandidates = candidates.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.roleTitle || c.appliedRole || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', RECRUITER_ID));
        if (userDoc.exists()) {
          setBalance(userDoc.data().credits || 0);
        }

        const q = query(collection(db, 'candidates'), where('recruiterId', '==', RECRUITER_ID));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCandidates(list);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  const chartData = filteredCandidates.map(c => ({
    name: c.name,
    icar: c.scoreResult?.icar?.percentile || 0,
    wleis: c.scoreResult?.wleis?.rawScores?.Total || 0,
  }));

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to permanently delete this candidate (GDPR)? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'candidates', id));
        setCandidates(prev => prev.filter(c => c.id !== id));
        if (selectedCandidate?.id === id) setSelectedCandidate(null);
      } catch (e) {
        alert("Failed to delete candidate.");
        console.error(e);
      }
    }
  };

  const updateStatus = async (status: string) => {
    if (!selectedCandidate) return;
    try {
      await updateDoc(doc(db, 'candidates', selectedCandidate.id), { status });
      setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, status } : c));
      setSelectedCandidate({ ...selectedCandidate, status });
    } catch (e) {
      alert("Failed to update status");
      console.error(e);
    }
  };

  const getDynamicPrompts = (c: any) => {
    if (!c?.scoreResult?.wleis?.rawScores) return [];
    const { SEA = 0, OEA = 0, UOE = 0, ROE = 0 } = c.scoreResult.wleis.rawScores;
    let prompts = [];
    if (SEA < 20) prompts.push("Can you describe a time you felt overwhelmed and how you recognized it?");
    if (OEA < 20) prompts.push("Tell me about a situation where you had to read the room and adjust your approach.");
    if (UOE < 20) prompts.push("Describe a time when you motivated yourself to complete a tedious task.");
    if (ROE < 20) prompts.push("How do you handle working with someone who is extremely stressed or frustrated?");
    if (c.scoreResult?.icar?.percentile < 30) prompts.push("Can you walk me through your step-by-step process for solving a completely new problem?");
    
    if (prompts.length === 0) {
      prompts.push("Your scores indicate balanced emotional intelligence and cognitive skills. How do you plan to leverage these strengths in this role?");
    }
    return prompts.slice(0, 3);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
                <p className="text-slate-500">Manage assessments and review candidates.</p>
              </div>
            </div>
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">Balance</span>
            <span className="font-bold text-lg text-slate-900 dark:text-white">{loading ? '...' : `${balance} Credits`}</span>
          </div>
          <Button onClick={async () => {
            const amount = prompt("How many credits to top up?");
            if (!amount || isNaN(parseInt(amount))) return;
            try {
              const topUp = httpsCallable(functions, 'topUpCredits');
              await topUp({ amount: parseInt(amount) });
              setBalance(b => b + parseInt(amount));
            } catch (e) {
              console.error(e);
              alert("Failed to top up.");
            }
          }}>Top Up Credits</Button>
          <ThemeToggle />
        </div>
      </header>
      
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-9" 
            placeholder="Search candidates by name, role, or status..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateLinkDialogOpen(true)}>Create New Link</Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Candidates</CardTitle>
            <CardDescription>Overview of recent applicants.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fit Score</TableHead>
                  <TableHead>Integrity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-slate-500">{c.roleTitle || c.appliedRole}</TableCell>
                    <TableCell>{c.status || 'Pending'}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        (c.fitBadge || c.fit || "").includes("Strong") ? "bg-green-50 text-green-700 border-green-200" :
                        (c.fitBadge || c.fit || "").includes("Conditional") ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        "bg-red-50 text-red-700 border-red-200"
                      }>
                        {c.fitBadge || c.fit || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.integrityEvents?.length > 0 ? (
                        <Badge variant="destructive">⚠️ Flagged</Badge>
                      ) : (
                        <span className="text-slate-400 text-sm">Clear</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedCandidate(c)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm mt-6">
          <CardHeader>
            <CardTitle>Candidate Benchmarking</CardTitle>
            <CardDescription>ICAR (Cognitive) vs WLEIS (Emotional Intelligence) Score Distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="icar" name="ICAR Percentile" unit="%ile" domain={[0, 100]} />
                <YAxis type="number" dataKey="wleis" name="WLEIS Score" domain={[16, 112]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-2 border rounded shadow text-sm">
                        <p className="font-bold">{data.name}</p>
                        <p>ICAR: {data.icar}%ile</p>
                        <p>WLEIS: {data.wleis}</p>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Scatter name="Candidates" data={chartData} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Drawer open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-3xl">
            <DrawerHeader>
              <DrawerTitle className="text-2xl">{selectedCandidate?.name}</DrawerTitle>
              <DrawerDescription>{selectedCandidate?.roleTitle || selectedCandidate?.appliedRole} • {selectedCandidate?.status}</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 space-y-6">
              <div className="flex gap-4 items-center">
                <Badge className="text-lg py-1 px-3" variant="secondary">{selectedCandidate?.fitBadge || selectedCandidate?.fit}</Badge>
                {selectedCandidate?.integrityEvents?.length > 0 && (
                  <Badge variant="destructive" className="text-lg py-1 px-3">⚠️ {selectedCandidate.integrityEvents.length} Integrity Flags</Badge>
                )}
                
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant={selectedCandidate?.status === "Shortlisted" ? "default" : "outline"} onClick={() => updateStatus("Shortlisted")}>Shortlist</Button>
                  <Button size="sm" variant={selectedCandidate?.status === "Interviewing" ? "default" : "outline"} onClick={() => updateStatus("Interviewing")}>Interview</Button>
                  <Button size="sm" variant={selectedCandidate?.status === "Rejected" ? "default" : "outline"} onClick={() => updateStatus("Rejected")}>Reject</Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm text-slate-500">Cognitive (ICAR)</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold">{selectedCandidate?.scoreResult?.icar?.percentile || 0}th <span className="text-sm font-normal text-slate-500">%ile</span></p></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm text-slate-500">Emotional Intelligence</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold">{selectedCandidate?.scoreResult?.wleis?.rawScores?.Total || 0} <span className="text-sm font-normal text-slate-500">Score</span></p></CardContent>
                </Card>
              </div>

              {selectedCandidate?.scoreResult && (
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
                      <p className="text-2xl font-bold">{selectedCandidate?.duration ? `${Math.round(selectedCandidate.duration / 60)}m ${selectedCandidate.duration % 60}s` : 'N/A'}</p>
                      <p className="text-xs text-slate-500 uppercase mt-1">Total Duration</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className={`text-2xl font-bold ${(selectedCandidate?.integrityEvents?.length || 0) > 2 ? 'text-red-500' : ''}`}>{selectedCandidate?.integrityEvents?.length || 0}</p>
                      <p className="text-xs text-slate-500 uppercase mt-1">Tab-Switch Blurs</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Custom Interview Prompts</h3>
                <Card className="bg-slate-50 dark:bg-slate-900/50">
                  <CardContent className="p-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {selectedCandidate ? getDynamicPrompts(selectedCandidate).map((p, i) => (
                      <p key={i}>{i + 1}. "{p}"</p>
                    )) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
            <DrawerFooter className="flex-row gap-4">
              <Button className="flex-1" onClick={() => window.print()}>Export PDF</Button>
              <Button variant="destructive" className="flex-1" onClick={() => selectedCandidate && handleDelete(selectedCandidate.id)}>Delete Data (GDPR)</Button>
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={createLinkDialogOpen} onOpenChange={setCreateLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assessment Links</DialogTitle>
            <DialogDescription>Generate links to send to candidates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-2">
              <Input 
                placeholder="Candidate Name" 
                id="candidateNameInput"
              />
              <Input 
                placeholder="Candidate Email (optional)" 
                id="candidateEmailInput"
                type="email"
              />
              <Input 
                placeholder="Role Title (e.g., Software Engineer)" 
                id="roleTitleInput"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateLinkDialogOpen(false)}>Cancel</Button>
            <Button disabled={balance <= 0} onClick={async () => {
              const roleTitle = (document.getElementById('roleTitleInput') as HTMLInputElement).value;
              const candidateName = (document.getElementById('candidateNameInput') as HTMLInputElement).value;
              const candidateEmail = (document.getElementById('candidateEmailInput') as HTMLInputElement).value;
              if (!roleTitle) return alert("Enter a role title");
              try {
                const createLink = httpsCallable(functions, 'createAssessmentLink');
                const res = await createLink({ roleTitle, candidateName, candidateEmail });
                const data = res.data as any;
                setBalance(b => b - 1);
                navigator.clipboard.writeText(data.url);
                alert("Link created and copied to clipboard!\n" + data.url);
                setCreateLinkDialogOpen(false);
              } catch (e) {
                console.error(e);
                alert("Failed to create link.");
              }
            }}>
              {balance <= 0 ? "Out of Credits - Top Up to Create" : "Generate Assessment Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
};
