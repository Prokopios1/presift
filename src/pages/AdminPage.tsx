import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';

interface RecruiterAccount {
  id: string;
  email?: string;
  companyName?: string;
  credits?: number;
  totalSpent?: number;
  vatId?: string;
  archived?: boolean;
  archivedAt?: string;
}

interface CandidateRecord {
  id: string;
  name?: string;
  appliedRole?: string;
  status?: string;
  fitBadge?: string;
  completionDate?: string;
  email?: string;
  createdAt?: string;
  cognitivePercentile?: number;
  eiPercentile?: number;
  integrityFlag?: boolean;
  clientIds?: string[];
}

// CSV helper — exported so AdminClientPage and tests can import it
export function buildCandidatesCsv(candidates: CandidateRecord[]): string {
  const headers = [
    'name', 'email', 'appliedRole', 'status', 'created',
    'cognitivePercentile', 'eiPercentile', 'fitBadge', 'integrityFlag',
  ];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = candidates.map(c => [
    escape(c.name),
    escape(c.email),
    escape(c.appliedRole),
    escape(c.status),
    escape(c.createdAt ? new Date(c.createdAt).toLocaleDateString() : c.completionDate ? new Date(c.completionDate).toLocaleDateString() : ''),
    escape(c.cognitivePercentile),
    escape(c.eiPercentile),
    escape(c.fitBadge),
    escape(c.integrityFlag),
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

export const AdminPage = () => {
  const navigate = useNavigate();
  const [recruiters, setRecruiters] = useState<RecruiterAccount[]>([]);
  const [candidateCounts, setCandidateCounts] = useState<Record<string, number | string>>({});
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Add Client state
  const [addClientDialog, setAddClientDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newVat, setNewVat] = useState('');
  const [newCredits, setNewCredits] = useState(5);
  const [newReason, setNewReason] = useState('Promo / testing');
  const [addingClient, setAddingClient] = useState(false);

  // Load recruiters + candidate counts
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const loaded: RecruiterAccount[] = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as RecruiterAccount & { role?: string }))
          .filter(u => u.role !== 'admin');
        setRecruiters(loaded);

        // Candidate count per non-archived client
        const nonArchived = loaded.filter(r => !r.archived);
        const countResults = await Promise.all(
          nonArchived.map(async r => {
            try {
              const cq = query(collection(db, 'candidates'), where('clientIds', 'array-contains', r.id));
              const snap2 = await getCountFromServer(cq);
              return { id: r.id, count: snap2.data().count as number | string };
            } catch {
              return { id: r.id, count: '–' as string };
            }
          })
        );
        const counts: Record<string, number | string> = {};
        for (const { id, count } of countResults) counts[id] = count;
        setCandidateCounts(counts);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleAddClient = async () => {
    if (!newName.trim() || !newCompany.trim() || !newEmail.trim() || newCredits < 0) return;
    setAddingClient(true);
    try {
      const createClient = httpsCallable(functions, 'createClient');
      const response = await createClient({
        name: newName.trim(),
        companyName: newCompany.trim(),
        email: newEmail.trim(),
        vatId: newVat.trim(),
        credits: newCredits,
        reason: newReason.trim() || 'Promo / testing'
      });
      const data = response.data as { id: string };

      const userData = {
        name: newName.trim(),
        companyName: newCompany.trim(),
        email: newEmail.trim(),
        vatId: newVat.trim(),
        credits: newCredits,
        totalSpent: 0,
        role: 'recruiter'
      };

      setRecruiters(prev => [...prev, { id: data.id, ...userData } as RecruiterAccount]);
      setAddClientDialog(false);
      setNewName('');
      setNewCompany('');
      setNewEmail('');
      setNewVat('');
      setNewCredits(5);
      setNewReason('Promo / testing');
    } catch (err) {
      console.error(err);
      alert('Failed to add client.');
    } finally {
      setAddingClient(false);
    }
  };

  const totalCreds = recruiters.reduce((s, r) => s + (r.credits || 0), 0);
  const totalRev = recruiters.reduce((s, r) => s + (r.totalSpent || 0), 0);
  const visibleRecruiters = showArchived ? recruiters : recruiters.filter(r => !r.archived);

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
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold tracking-tight">Owner Dashboard</h1>
                  <Badge className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-none">Admin</Badge>
                </div>
              <p className="text-slate-500">Global overview of all PreSift customer accounts.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived">Show archived</Label>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setAddClientDialog(true)}>Add Client</Button>
              </TooltipTrigger>
              <TooltipContent>Create a new customer account</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Customers', value: recruiters.length },
            { label: 'Credits Outstanding', value: totalCreds },
            { label: 'Total Revenue', value: `€${totalRev.toFixed(2)}` },
          ].map((s, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-xs uppercase tracking-wider font-semibold">{s.label}</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? '...' : s.value}</p></CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Customer Accounts</CardTitle>
            <CardDescription>Click any row to view the client detail page.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-slate-500 py-8 text-center">Loading...</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Account ID</TableHead><TableHead>Email</TableHead><TableHead>Company</TableHead>
                  <TableHead>VAT ID</TableHead><TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Candidates</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visibleRecruiters.map(r => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/50 ${r.archived ? 'opacity-50' : ''}`}
                      onClick={() => navigate(`/admin/clients/${r.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>{r.email || '—'}</TableCell>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {r.companyName || '—'}
                          {r.archived && (
                            <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-none text-xs">Archived</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{r.vatId || '—'}</TableCell>
                      <TableCell className="text-right font-bold">{r.credits ?? 0}</TableCell>
                      <TableCell className="text-right text-slate-500">€{(r.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-slate-500 text-sm">
                        {r.archived ? '–' : (candidateCounts[r.id] !== undefined ? String(candidateCounts[r.id]) : '…')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Client Dialog */}
        <Dialog open={addClientDialog} onOpenChange={setAddClientDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>Create a new customer account and grant initial credits.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name (required)</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label>Company Name (required)</Label>
                <Input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>Email (required)</Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="hello@acme.com" />
              </div>
              <div className="space-y-2">
                <Label>VAT/Tax ID (optional)</Label>
                <Input value={newVat} onChange={e => setNewVat(e.target.value)} placeholder="e.g. DE123456789" />
              </div>
              <div className="space-y-2">
                <Label>Free credits for promo/testing</Label>
                <Input type="number" min="0" value={newCredits} onChange={e => setNewCredits(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g., Promo / testing" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddClientDialog(false)}>Cancel</Button>
              <Button
                onClick={handleAddClient}
                disabled={addingClient || !newName.trim() || !newCompany.trim() || !newEmail.trim() || newCredits < 0}
              >
                {addingClient ? 'Saving...' : 'Create Client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </main>
    </div>
  );
};
