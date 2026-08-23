import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Edit, Copy, Trash2, Archive, ArchiveRestore, ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppSidebar } from '@/components/AppSidebar';

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, LabelList } from 'recharts';

const RECRUITER_ID = 'demo_recruiter';

export const toggleSelectAll = (
  currentSelected: Set<string>,
  filteredIds: string[],
  shouldSelect: boolean
): Set<string> => {
  const next = new Set(currentSelected);
  if (shouldSelect) {
    filteredIds.forEach(id => next.add(id));
  } else {
    filteredIds.forEach(id => next.delete(id));
  }
  return next;
};

export const toggleSelectRow = (
  currentSelected: Set<string>,
  id: string,
  shouldSelect: boolean
): Set<string> => {
  const next = new Set(currentSelected);
  if (shouldSelect) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
};

export const getSelectionState = (
  selectedIds: Set<string>,
  filteredIds: string[]
): { isAllSelected: boolean; isSomeSelected: boolean } => {
  if (filteredIds.length === 0) {
    return { isAllSelected: false, isSomeSelected: false };
  }
  const isAllSelected = filteredIds.every(id => selectedIds.has(id));
  const isSomeSelected = filteredIds.some(id => selectedIds.has(id)) && !isAllSelected;
  return { isAllSelected, isSomeSelected };
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [recruiterIdentifier, setRecruiterIdentifier] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [createLinkDialogOpen, setCreateLinkDialogOpen] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [editCandidateDialog, setEditCandidateDialog] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Record<string, any>>({});

  const headerCheckboxRef = useRef<HTMLButtonElement | HTMLInputElement>(null);

  const filteredCandidates = candidates.filter(c => {
    if (!showArchived && c.archived) return false;
    const q = searchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.roleTitle || c.appliedRole || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q)
    );
  });

  const filteredCandidateIds = filteredCandidates.map(c => c.id);
  const { isAllSelected, isSomeSelected } = getSelectionState(selectedCandidateIds, filteredCandidateIds);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      (headerCheckboxRef.current as any).indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', RECRUITER_ID));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setBalance(data.credits || 0);
          let identifier = '';
          if (data.name && data.name.trim()) {
            identifier = data.name.trim();
          } else if (data.companyName && data.companyName.trim()) {
            identifier = data.companyName.trim();
          } else if (data.email) {
            identifier = data.email.split('@')[0];
          }
          setRecruiterIdentifier(identifier);
        }

        const q = query(collection(db, 'candidates'), where('recruiterId', '==', RECRUITER_ID));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCandidates(list);

        const campaignsQ = query(collection(db, 'campaigns'), where('recruiterId', '==', RECRUITER_ID));
        const campaignsSnap = await getDocs(campaignsQ);
        const camps = campaignsSnap.docs.reduce((acc, d) => {
          acc[d.id] = d.data();
          return acc;
        }, {} as Record<string, any>);
        setCampaigns(camps);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
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

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    const shouldSelect = checked === true || checked === 'indeterminate';
    setSelectedCandidateIds(prev => toggleSelectAll(prev, filteredCandidateIds, shouldSelect));
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedCandidateIds(prev => toggleSelectRow(prev, id, checked));
  };

  const handleBulkDelete = async () => {
    if (selectedCandidateIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedCandidateIds.size} candidate(s)? This cannot be undone.`)) {
      try {
        const bulkDelete = httpsCallable(functions, 'bulkDeleteCandidates');
        await bulkDelete({ candidateIds: Array.from(selectedCandidateIds) });
        setCandidates(prev => prev.filter(c => !selectedCandidateIds.has(c.id)));
        setSelectedCandidateIds(new Set());
      } catch (e) {
        alert('Failed to delete candidates.');
        console.error(e);
      }
    }
  };

  const handleCopyLink = async (id: string, archived: boolean) => {
    if (archived) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/assessment/${id}`);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(prev => (prev === id ? null : prev));
      }, 2000);
    } catch(e) {
      console.error(e);
    }
  };
  
  const handleEditCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCandidateDialog) return;
    try {
      const updateCandidate = httpsCallable(functions, 'updateCandidate');
      await updateCandidate({
        candidateId: editCandidateDialog.id,
        name: editCandidateDialog.name,
        email: editCandidateDialog.email,
        appliedRole: editCandidateDialog.appliedRole
      });
      setCandidates(prev => prev.map(c => c.id === editCandidateDialog.id ? { ...c, ...editCandidateDialog } : c));
      if (editCandidateDialog.id === copiedId) {
        // Just avoiding removing selectedCandidate which was removed
      }
      setEditCandidateDialog(null);
    } catch(e) {
      alert('Failed to edit candidate.');
      console.error(e);
    }
  };

  const handleArchiveCandidate = async (c: any) => {
    const newArchived = !c.archived;
    try {
      const archiveCandidate = httpsCallable(functions, 'archiveCandidate');
      await archiveCandidate({ candidateId: c.id, archived: newArchived });
      setCandidates(prev => prev.map(x => x.id === c.id ? { ...x, archived: newArchived } : x));
    } catch (e) {
      alert('Failed to archive/unarchive candidate.');
      console.error(e);
    }
  };


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

            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
                <p className="text-slate-500">Manage assessments and review candidates.</p>
<p className="text-slate-500">Recruiter: {recruiterIdentifier}</p>
              </div>
            </div>
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">Balance</span>
            <span className="font-bold text-lg text-slate-900 dark:text-white">{loading ? '...' : `${balance} Credits`}</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={async () => {
                const amount = prompt('How many credits to top up?');
                if (!amount || isNaN(parseInt(amount))) return;
                try {
                  const topUp = httpsCallable(functions, 'topUpCredits');
                  await topUp({ amount: parseInt(amount) });
                  setBalance(b => b + parseInt(amount));
                } catch (e) {
                  console.error(e);
                  alert('Failed to top up.');
                }
              }}>Top Up Credits</Button>
            </TooltipTrigger>
            <TooltipContent>Add more assessment credits to your account</TooltipContent>
            </Tooltip>
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
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Switch id="show-archived-dash" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived-dash">Show archived</Label>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => navigate('/assessments/new')}>+ Create New Assessment</Button>
          </TooltipTrigger>
          <TooltipContent>Start a new campaign wizard to assess candidates</TooltipContent>
        </Tooltip>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Candidates</CardTitle>
              <CardDescription>Overview of recent applicants.</CardDescription>
            </div>
            {selectedCandidateIds.size > 0 && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-600 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">
                <span className="text-sm font-medium">{selectedCandidateIds.size} selected</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete}><Trash2 className="w-4 h-4 mr-2" /> Delete selected</Button>
                  </TooltipTrigger>
                  <TooltipContent>Permanently delete selected candidates</TooltipContent>
                </Tooltip>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      ref={headerCheckboxRef as any}
                      checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Campaign / Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fit Score</TableHead>
                  <TableHead>Integrity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((c) => (
                  <TableRow key={c.id} className={c.archived ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedCandidateIds.has(c.id)}
                        onCheckedChange={(checked) => handleSelectRow(c.id, !!checked)}
                        aria-label={`Select ${c.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {c.name}
                        {c.archived && <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-none text-xs">Archived</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {c.campaignId && campaigns[c.campaignId] 
                        ? campaigns[c.campaignId].positionTitle 
                        : (c.roleTitle || c.appliedRole)}
                    </TableCell>
                    <TableCell>{c.status || 'Pending'}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        (c.fitBadge || c.fit || '').includes('Strong') ? 'bg-green-50 text-green-700 border-green-200' :
                        (c.fitBadge || c.fit || '').includes('Conditional') ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }>
                        {c.fitBadge || c.fit || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.integrityEvents?.length > 0 ? (
                        <Badge variant="destructive">⚠️ Flagged</Badge>
                      ) : (
                        <span className="text-slate-400 text-sm">Clear</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleCopyLink(c.id, !!c.archived)} 
                            disabled={!!c.archived}
                            aria-label={`Copy link for ${c.name}`}
                          >
                            {copiedId === c.id ? (
                              <span className="text-xs font-semibold text-green-600">Copied</span>
                            ) : (
                              <Copy className="w-4 h-4 text-slate-500" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{c.archived ? 'Cannot copy link for archived candidate' : 'Copy assessment link'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditCandidateDialog({ id: c.id, name: c.name || '', email: c.email || '', appliedRole: c.roleTitle || c.appliedRole || '' })} 
                            aria-label={`Edit ${c.name}`}
                          >
                            <Edit className="w-4 h-4 text-slate-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit candidate details</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleArchiveCandidate(c)}
                            aria-label={c.archived ? `Unarchive ${c.name}` : `Archive ${c.name}`}
                          >
                            {c.archived
                              ? <ArchiveRestore className="w-4 h-4 text-slate-500" />
                              : <Archive className="w-4 h-4 text-slate-500" />
                            }
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{c.archived ? 'Unarchive this candidate' : 'Archive this candidate — hides from active list'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/candidate/${c.id}`)}>View</Button>
                        </TooltipTrigger>
                        <TooltipContent>View candidate profile and scores</TooltipContent>
                      </Tooltip>
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
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
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
                <Scatter name="Candidates" data={chartData} fill="#3b82f6">
  <LabelList dataKey="name" position="top" className="text-xs fill-current text-gray-700 dark:text-gray-300" />
</Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
              if (!roleTitle) return alert('Enter a role title');
              try {
                const createLink = httpsCallable(functions, 'createAssessmentLink');
                const res = await createLink({ roleTitle, candidateName, candidateEmail });
                const data = res.data as any;
                setBalance(b => b - 1);
                navigator.clipboard.writeText(data.url);
                alert('Link created and copied to clipboard!\n' + data.url);
                setCreateLinkDialogOpen(false);
              } catch (e) {
                console.error(e);
                alert('Failed to create link.');
              }
            }}>
              {balance <= 0 ? 'Out of Credits - Top Up to Create' : 'Generate Assessment Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!editCandidateDialog} onOpenChange={(o) => !o && setEditCandidateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
            <DialogDescription>Update the candidate's details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCandidate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Candidate Name</Label>
                <Input 
                  value={editCandidateDialog?.name || ''} 
                  onChange={e => setEditCandidateDialog({ ...editCandidateDialog, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Candidate Email</Label>
                <Input 
                  type="email"
                  value={editCandidateDialog?.email || ''} 
                  onChange={e => setEditCandidateDialog({ ...editCandidateDialog, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Applied Role</Label>
                <Input 
                  value={editCandidateDialog?.appliedRole || ''} 
                  onChange={e => setEditCandidateDialog({ ...editCandidateDialog, appliedRole: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditCandidateDialog(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
};
