import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { collection, getDocs, doc, updateDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RecruiterAccount { id: string; email?: string; companyName?: string; credits?: number; totalSpent?: number; vatId?: string; }
interface CandidateRecord { id: string; name?: string; appliedRole?: string; status?: string; fitBadge?: string; completionDate?: string; }

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
    setLoadingCandidates(true);
    try {
      const q = query(collection(db, 'candidates'), where('recruiterId', '==', r.id));
      const snap = await getDocs(q);
      setRecruiterCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() } as CandidateRecord)));
    } catch (err) { console.error(err); }
    finally { setLoadingCandidates(false); }
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

  const totalCreds = recruiters.reduce((s, r) => s + (r.credits || 0), 0);
  const totalRev = recruiters.reduce((s, r) => s + (r.totalSpent || 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Owner Dashboard</h1>
            <Badge className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-none">Admin</Badge>
          </div>
          <p className="text-slate-500">Global overview of all PreSift customer accounts.</p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>← Recruiter View</Button>
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
              <DrawerTitle className="text-2xl">{selectedRecruiter?.companyName || selectedRecruiter?.id}</DrawerTitle>
              <DrawerDescription>{selectedRecruiter?.email} • {selectedRecruiter?.credits ?? 0} credits</DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              {loadingCandidates ? <p className="text-slate-500 py-8 text-center">Loading...</p> :
               recruiterCandidates.length === 0 ? <p className="text-slate-400 py-8 text-center">No candidates.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Fit</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {recruiterCandidates.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name || '—'}</TableCell>
                        <TableCell className="text-slate-500">{c.appliedRole || '—'}</TableCell>
                        <TableCell>{c.status || 'Pending'}</TableCell>
                        <TableCell className="text-slate-500 text-sm">{c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={
                          (c.fitBadge || "").includes("Strong") ? "bg-green-50 text-green-700 border-green-200" :
                          (c.fitBadge || "").includes("Conditional") ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }>{c.fitBadge || "Unknown"}</Badge></TableCell>
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
    </div>
  );
};
