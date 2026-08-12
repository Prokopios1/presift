import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Copy, Trash2 } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { AppSidebar } from '@/components/AppSidebar';
import { toggleSelectAll, toggleSelectRow, getSelectionState } from './DashboardPage';

interface RecruiterAccount { id: string; email?: string; companyName?: string; credits?: number; totalSpent?: number; vatId?: string; }
interface CandidateRecord { id: string; name?: string; appliedRole?: string; status?: string; fitBadge?: string; completionDate?: string; email?: string; }

export const AdminPage = () => {
  const [recruiters, setRecruiters] = useState<RecruiterAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterAccount | null>(null);
  const [recruiterCandidates, setRecruiterCandidates] = useState<CandidateRecord[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [creditDialog, setCreditDialog] = useState(false);
  const [creditTarget, setCreditTarget] = useState<RecruiterAccount | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState('');
  const [creditSaving, setCreditSaving] = useState(false);

  // Add Client state
  const [addClientDialog, setAddClientDialog] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newVat, setNewVat] = useState('');
  const [newCredits, setNewCredits] = useState(5);
  const [newReason, setNewReason] = useState('Promo / testing');
  const [addingClient, setAddingClient] = useState(false);

  // Candidate management state
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [editCandidateDialog, setEditCandidateDialog] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const headerCheckboxRef = useRef<HTMLButtonElement | HTMLInputElement>(null);

  const candidateIds = recruiterCandidates.map(c => c.id);
  const { isAllSelected, isSomeSelected } = getSelectionState(selectedCandidateIds, candidateIds);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      (headerCheckboxRef.current as any).indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setRecruiters(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecruiterAccount)));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleDeepDive = async (r: RecruiterAccount) => {
    setSelectedRecruiter(r);
    setSelectedCandidateIds(new Set());
    setLoadingCandidates(true);
    try {
      const q = query(collection(db, 'candidates'), where('recruiterId', '==', r.id));
      const snap = await getDocs(q);
      setRecruiterCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() } as CandidateRecord)));
    } catch (err) { console.error(err); }
    finally { setLoadingCandidates(false); }
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    const shouldSelect = checked === true || checked === 'indeterminate';
    setSelectedCandidateIds(prev => toggleSelectAll(prev, candidateIds, shouldSelect));
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
        setRecruiterCandidates(prev => prev.filter(c => !selectedCandidateIds.has(c.id)));
        setSelectedCandidateIds(new Set());
      } catch (e) {
        alert("Failed to delete candidates.");
        console.error(e);
      }
    }
  };

  const handleCopyLink = async (id: string) => {
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
      setRecruiterCandidates(prev => prev.map(c => c.id === editCandidateDialog.id ? { ...c, ...editCandidateDialog } : c));
      setEditCandidateDialog(null);
    } catch(e) {
      alert("Failed to edit candidate.");
      console.error(e);
    }
  };

  const handleCreditAdjust = async () => {
    if (!creditTarget || creditAmount === 0 || !creditReason.trim()) return;
    setCreditSaving(true);
    try {
      const newBal = Math.max(0, (creditTarget.credits || 0) + creditAmount);
      await updateDoc(doc(db, 'users', creditTarget.id), { credits: newBal });
      await addDoc(collection(db, 'users', creditTarget.id, 'creditAuditLog'), {
        amount: creditAmount, reason: creditReason.trim(), adjustedBy: 'admin',
        previousBalance: creditTarget.credits || 0, newBalance: newBal, createdAt: serverTimestamp(),
      });
      setRecruiters(prev => prev.map(r => r.id === creditTarget.id ? { ...r, credits: newBal } : r));
      setCreditDialog(false); setCreditAmount(0); setCreditReason(''); setCreditTarget(null);
    } catch (err) { console.error(err); alert("Failed to adjust credits."); }
    finally { setCreditSaving(false); }
  };

  const handleAddClient = async () => {
    if (!newCompany.trim() || !newEmail.trim() || newCredits < 0) return;
    setAddingClient(true);
    try {
      const userData = {
        companyName: newCompany.trim(),
        email: newEmail.trim(),
        vatId: newVat.trim(),
        credits: newCredits,
        totalSpent: 0,
        role: 'recruiter',
        createdAt: serverTimestamp()
      };
      
      const userRef = await addDoc(collection(db, 'users'), userData);
      
      await addDoc(collection(db, 'users', userRef.id, 'creditAuditLog'), {
        amount: newCredits,
        reason: newReason.trim() || 'Promo / testing',
        adjustedBy: 'admin',
        previousBalance: 0,
        newBalance: newCredits,
        createdAt: serverTimestamp()
      });

      setRecruiters(prev => [...prev, { id: userRef.id, ...userData } as RecruiterAccount]);
      setAddClientDialog(false);
      setNewCompany('');
      setNewEmail('');
      setNewVat('');
      setNewCredits(5);
      setNewReason('Promo / testing');
    } catch (err) {
      console.error(err);
      alert("Failed to add client.");
    } finally {
      setAddingClient(false);
    }
  };

  const totalCreds = recruiters.reduce((s, r) => s + (r.credits || 0), 0);
  const totalRev = recruiters.reduce((s, r) => s + (r.totalSpent || 0), 0);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>← Recruiter View</Button>
          <Button onClick={() => setAddClientDialog(true)}>Add Client</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Customers", value: recruiters.length },
          { label: "Credits Outstanding", value: totalCreds },
          { label: "Total Revenue", value: `€${totalRev.toFixed(2)}` },
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
          <CardDescription>Click any row to view their candidates.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-slate-500 py-8 text-center">Loading...</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Account ID</TableHead><TableHead>Email</TableHead><TableHead>Company</TableHead>
                <TableHead>VAT ID</TableHead><TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {recruiters.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/50" onClick={() => handleDeepDive(r)}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>{r.email || '—'}</TableCell>
                    <TableCell>{r.companyName || '—'}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{r.vatId || '—'}</TableCell>
                    <TableCell className="text-right font-bold">{r.credits ?? 0}</TableCell>
                    <TableCell className="text-right text-slate-500">€{(r.totalSpent || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setCreditTarget(r); setCreditDialog(true); }}>Adjust</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer open={!!selectedRecruiter} onOpenChange={(o) => !o && setSelectedRecruiter(null)}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-4xl p-4">
            <DrawerHeader>
              <DrawerTitle className="text-2xl flex items-center justify-between">
                <span>{selectedRecruiter?.companyName || selectedRecruiter?.id}</span>
                {selectedCandidateIds.size > 0 && (
                  <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-600 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-sm font-normal">
                    <span>{selectedCandidateIds.size} selected</span>
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete}><Trash2 className="w-4 h-4 mr-2" /> Delete selected</Button>
                  </div>
                )}
              </DrawerTitle>
              <DrawerDescription>{selectedRecruiter?.email} • {selectedRecruiter?.credits ?? 0} credits</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingCandidates ? <p className="text-slate-500 py-8 text-center">Loading...</p> :
               recruiterCandidates.length === 0 ? <p className="text-slate-400 py-8 text-center">No candidates.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        ref={headerCheckboxRef as any}
                        checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Fit</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {recruiterCandidates.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedCandidateIds.has(c.id)}
                            onCheckedChange={(checked) => handleSelectRow(c.id, !!checked)}
                            aria-label={`Select ${c.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.name || '—'}</TableCell>
                        <TableCell className="text-slate-500">{c.appliedRole || '—'}</TableCell>
                        <TableCell>{c.status || 'Pending'}</TableCell>
                        <TableCell className="text-slate-500 text-sm">{c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={
                          (c.fitBadge || "").includes("Strong") ? "bg-green-50 text-green-700 border-green-200" :
                          (c.fitBadge || "").includes("Conditional") ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }>{c.fitBadge || "Unknown"}</Badge></TableCell>
                        <TableCell className="text-right flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleCopyLink(c.id)} 
                            title={copiedId === c.id ? "Copied!" : "Copy assessment link"}
                            aria-label={`Copy link for ${c.name}`}
                          >
                            {copiedId === c.id ? (
                              <span className="text-xs font-semibold text-green-600">Copied</span>
                            ) : (
                              <Copy className="w-4 h-4 text-slate-500" />
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditCandidateDialog({ id: c.id, name: c.name || '', email: c.email || '', appliedRole: c.appliedRole || '' })} 
                            title="Edit candidate"
                            aria-label={`Edit ${c.name}`}
                          >
                            <Edit className="w-4 h-4 text-slate-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={creditDialog} onOpenChange={setCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>Grant or deduct credits for {creditTarget?.email || creditTarget?.id}. Balance: {creditTarget?.credits ?? 0}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (positive to grant, negative to deduct)</Label>
              <Input type="number" value={creditAmount} onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="e.g., Courtesy credit" />
            </div>
            {creditAmount !== 0 && <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm">New balance: <strong>{Math.max(0, (creditTarget?.credits || 0) + creditAmount)}</strong></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(false)}>Cancel</Button>
            <Button onClick={handleCreditAdjust} disabled={creditSaving || creditAmount === 0 || !creditReason.trim()}>
              {creditSaving ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addClientDialog} onOpenChange={setAddClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Create a new customer account and grant initial credits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name (required)</Label>
              <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Acme Corp" />
            </div>
            <div className="space-y-2">
              <Label>Email (required)</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="hello@acme.com" />
            </div>
            <div className="space-y-2">
              <Label>VAT/Tax ID (optional)</Label>
              <Input value={newVat} onChange={(e) => setNewVat(e.target.value)} placeholder="e.g. DE123456789" />
            </div>
            <div className="space-y-2">
              <Label>Free credits for promo/testing</Label>
              <Input type="number" min="0" value={newCredits} onChange={(e) => setNewCredits(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g., Promo / testing" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleAddClient} 
              disabled={addingClient || !newCompany.trim() || !newEmail.trim() || newCredits < 0}
            >
              {addingClient ? "Saving..." : "Create Client"}
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
                  onChange={(e) => setEditCandidateDialog({ ...editCandidateDialog, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Candidate Email</Label>
                <Input 
                  type="email"
                  value={editCandidateDialog?.email || ''} 
                  onChange={(e) => setEditCandidateDialog({ ...editCandidateDialog, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Applied Role</Label>
                <Input 
                  value={editCandidateDialog?.appliedRole || ''} 
                  onChange={(e) => setEditCandidateDialog({ ...editCandidateDialog, appliedRole: e.target.value })}
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
