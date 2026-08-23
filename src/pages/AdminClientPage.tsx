import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Edit, Copy, Trash2, Archive, ArchiveRestore, Users, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  collection, getDocs, query, where, doc, getDoc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { buildCandidatesCsv } from './AdminPage';
import { toggleSelectAll, toggleSelectRow, getSelectionState } from './DashboardPage';

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
  archived?: boolean;
}

interface AuditEntry {
  id: string;
  amount: number;
  reason: string;
  adjustedBy: string;
  createdAt?: any;
  previousBalance?: number;
  newBalance?: number;
}

// Callables
const callUpdateClient = httpsCallable(functions, 'updateClient');
const callArchiveClient = httpsCallable(functions, 'archiveClient');
const callUpdateCandidateClients = httpsCallable(functions, 'updateCandidateClients');
const callArchiveCandidate = httpsCallable(functions, 'archiveCandidate');

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const AdminClientPage = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<RecruiterAccount | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Show archived candidates
  const [showArchived, setShowArchived] = useState(false);

  // Candidate search
  const [candidateSearch, setCandidateSearch] = useState('');

  // Copy link state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selection
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLButtonElement | HTMLInputElement>(null);

  // Edit client dialog
  const [editClientDialog, setEditClientDialog] = useState(false);
  const [editCompany, setEditCompany] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editVat, setEditVat] = useState('');
  const [editClientSaving, setEditClientSaving] = useState(false);
  const editClientValid = editCompany.trim().length > 0 && editEmail.trim().length > 0;

  // Archive state
  const [archivingClient, setArchivingClient] = useState(false);

  // Credit adjust dialog
  const [creditDialog, setCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState('');
  const [creditSaving, setCreditSaving] = useState(false);

  // Edit candidate dialog
  const [editCandidateDialog, setEditCandidateDialog] = useState<any>(null);

  // Manage candidates dialog
  const [manageCandidatesDialog, setManageCandidatesDialog] = useState(false);
  const [allCandidates, setAllCandidates] = useState<CandidateRecord[]>([]);
  const [manageSearch, setManageSearch] = useState('');
  const [managedMembership, setManagedMembership] = useState<Set<string>>(new Set());
  const [originalMembership, setOriginalMembership] = useState<Set<string>>(new Set());
  const [manageSaving, setManageSaving] = useState(false);
  const [manageProgress, setManageProgress] = useState('');
  const [loadingAllCandidates, setLoadingAllCandidates] = useState(false);

  // Derived
  const visibleCandidates = candidates.filter(c => {
    if (!showArchived && c.archived) return false;
    const q = candidateSearch.toLowerCase();
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });
  const visibleIds = visibleCandidates.map(c => c.id);
  const { isAllSelected, isSomeSelected } = getSelectionState(selectedCandidateIds, visibleIds);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      (headerCheckboxRef.current as any).indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  // Load client + candidates + audit log
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const [clientSnap, candidatesSnap, auditSnap] = await Promise.all([
          getDoc(doc(db, 'users', clientId)),
          getDocs(query(collection(db, 'candidates'), where('clientIds', 'array-contains', clientId))),
          getDocs(collection(db, 'users', clientId, 'creditAuditLog')),
        ]);

        if (!clientSnap.exists()) {
          setError('Client not found.');
          return;
        }
        setClient({ id: clientSnap.id, ...clientSnap.data() } as RecruiterAccount);
        setCandidates(candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CandidateRecord)));
        setAuditLog(auditSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry)));
      } catch (err) {
        console.error(err);
        setError('Failed to load client data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  const openEditClientDialog = () => {
    if (!client) return;
    setEditCompany(client.companyName || '');
    setEditEmail(client.email || '');
    setEditVat(client.vatId || '');
    setEditClientDialog(true);
  };

  const handleEditClient = async () => {
    if (!client) return;
    setEditClientSaving(true);
    try {
      const trimmedVat = editVat.trim();
      await callUpdateClient({
        clientId: client.id,
        companyName: editCompany.trim(),
        email: editEmail.trim(),
        ...(trimmedVat !== '' && { vatId: trimmedVat }),
      });
      const updated: RecruiterAccount = {
        ...client,
        companyName: editCompany.trim(),
        email: editEmail.trim(),
        ...(trimmedVat !== '' ? { vatId: trimmedVat } : { vatId: client.vatId }),
      };
      setClient(updated);
      setEditClientDialog(false);
    } catch (err) {
      alert('Failed to update client.');
      console.error(err);
    } finally {
      setEditClientSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!client) return;
    setArchivingClient(true);
    const newArchived = !client.archived;
    try {
      await callArchiveClient({ clientId: client.id, archived: newArchived });
      setClient(prev => prev ? {
        ...prev,
        archived: newArchived,
        archivedAt: newArchived ? new Date().toISOString() : undefined,
      } : prev);
    } catch (err) {
      alert('Failed to archive/unarchive client.');
      console.error(err);
    } finally {
      setArchivingClient(false);
    }
  };

  const handleCreditAdjust = async () => {
    if (!client || creditAmount === 0 || !creditReason.trim()) return;
    setCreditSaving(true);
    try {
      const newBal = Math.max(0, (client.credits || 0) + creditAmount);
      await updateDoc(doc(db, 'users', client.id), { credits: newBal });
      await addDoc(collection(db, 'users', client.id, 'creditAuditLog'), {
        amount: creditAmount, reason: creditReason.trim(), adjustedBy: 'admin',
        previousBalance: client.credits || 0, newBalance: newBal, createdAt: serverTimestamp(),
      });
      setClient(prev => prev ? { ...prev, credits: newBal } : prev);
      const newEntry: AuditEntry = {
        id: `local_${Date.now()}`,
        amount: creditAmount,
        reason: creditReason.trim(),
        adjustedBy: 'admin',
        previousBalance: client.credits || 0,
        newBalance: newBal,
      };
      setAuditLog(prev => [newEntry, ...prev]);
      setCreditDialog(false);
      setCreditAmount(0);
      setCreditReason('');
    } catch (err) {
      console.error(err);
      alert('Failed to adjust credits.');
    } finally {
      setCreditSaving(false);
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
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchiveCandidate = async (c: CandidateRecord) => {
    const newArchived = !c.archived;
    try {
      await callArchiveCandidate({ candidateId: c.id, archived: newArchived });
      setCandidates(prev => prev.map(x => x.id === c.id ? { ...x, archived: newArchived } : x));
    } catch (e) {
      alert('Failed to archive/unarchive candidate.');
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
        appliedRole: editCandidateDialog.appliedRole,
      });
      setCandidates(prev => prev.map(c => c.id === editCandidateDialog.id ? { ...c, ...editCandidateDialog } : c));
      setEditCandidateDialog(null);
    } catch (e) {
      alert('Failed to edit candidate.');
      console.error(e);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this candidate (GDPR)? This cannot be undone.')) return;
    try {
      const deleteCandidate = httpsCallable(functions, 'deleteCandidate');
      await deleteCandidate({ candidateId: id });
      setCandidates(prev => prev.filter(c => c.id !== id));
      setSelectedCandidateIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (e) {
      alert('Failed to delete candidate.');
      console.error(e);
    }
  };

  const handleUpdateStatus = async (candidateId: string, status: string) => {
    try {
      const updateCandidateStatus = httpsCallable(functions, 'updateCandidateStatus');
      await updateCandidateStatus({ candidateId, status });
      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status } : c));
    } catch (e) {
      alert('Failed to update status.');
      console.error(e);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCandidateIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedCandidateIds.size} candidate(s)? This cannot be undone.`)) return;
    try {
      const bulkDelete = httpsCallable(functions, 'bulkDeleteCandidates');
      await bulkDelete({ candidateIds: Array.from(selectedCandidateIds) });
      setCandidates(prev => prev.filter(c => !selectedCandidateIds.has(c.id)));
      setSelectedCandidateIds(new Set());
    } catch (e) {
      alert('Failed to delete candidates.');
      console.error(e);
    }
  };

  const handleExportCsv = () => {
    if (!client) return;
    const csv = buildCandidatesCsv(visibleCandidates);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = slugify(client.companyName || client.id);
    a.download = `clients-${slug}-candidates.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openManageCandidates = async () => {
    if (!client) return;
    setManageCandidatesDialog(true);
    setManageSearch('');
    setManageProgress('');
    setLoadingAllCandidates(true);
    try {
      const snap = await getDocs(collection(db, 'candidates'));
      const all: CandidateRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as CandidateRecord));
      setAllCandidates(all);
      const initialMembership = new Set<string>(
        all.filter(c => (c.clientIds ?? []).includes(client.id)).map(c => c.id)
      );
      setManagedMembership(initialMembership);
      setOriginalMembership(initialMembership);
    } catch (err) {
      alert('Failed to load candidates.');
      console.error(err);
    } finally {
      setLoadingAllCandidates(false);
    }
  };

  const handleManageSave = async () => {
    if (!client) return;
    setManageSaving(true);
    setManageProgress('');
    try {
      const changed: Array<{ candidate: CandidateRecord; newClientIds: string[] }> = [];
      for (const c of allCandidates) {
        const wasIncluded = originalMembership.has(c.id);
        const isIncluded = managedMembership.has(c.id);
        if (wasIncluded !== isIncluded) {
          const existingClientIds = c.clientIds ?? [];
          const newClientIds = isIncluded
            ? [...existingClientIds, client.id]
            : existingClientIds.filter(id => id !== client.id);
          changed.push({ candidate: c, newClientIds });
        }
      }
      for (let i = 0; i < changed.length; i++) {
        setManageProgress(`${i + 1} of ${changed.length} updated`);
        const { candidate, newClientIds } = changed[i];
        await callUpdateCandidateClients({ candidateId: candidate.id, clientIds: newClientIds });
      }
      // Reload candidates for this client
      const snap = await getDocs(query(collection(db, 'candidates'), where('clientIds', 'array-contains', client.id)));
      setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() } as CandidateRecord)));
      setManageCandidatesDialog(false);
    } catch (err) {
      alert('Failed to save candidate associations.');
      console.error(err);
    } finally {
      setManageSaving(false);
      setManageProgress('');
    }
  };

  const filteredManageCandidates = allCandidates.filter(c => {
    const q = manageSearch.toLowerCase();
    return !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <AppSidebar />
        <main className="flex-1 w-full pl-0 md:pl-60 flex items-center justify-center">
          <p className="text-slate-500">Loading client...</p>
        </main>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <AppSidebar />
        <main className="flex-1 w-full pl-0 md:pl-60 flex items-center justify-center">
          <p className="text-red-500">{error || 'Client not found.'}</p>
        </main>
      </div>
    );
  }

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

          {/* Header */}
          <header className="border-b pb-6 space-y-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/admin')}
                  className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  ← Clients
                </button>
              </TooltipTrigger>
              <TooltipContent>Return to clients list</TooltipContent>
            </Tooltip>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{client.companyName || client.id}</h1>
                {client.archived && (
                  <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-none">Archived</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={openEditClientDialog}>
                      <Edit className="w-4 h-4 mr-1" />Edit
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit client details</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleArchiveToggle}
                      disabled={archivingClient}
                      aria-label={client.archived ? 'Unarchive client' : 'Archive client'}
                    >
                      {client.archived
                        ? <><ArchiveRestore className="w-4 h-4 mr-1" />Unarchive</>
                        : <><Archive className="w-4 h-4 mr-1" />Archive</>
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{client.archived ? 'Restore this client' : 'Archive this client — hides it from the list'}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <p className="text-slate-500 text-sm">{client.email}{client.vatId ? ` • VAT: ${client.vatId}` : ''} • {client.credits ?? 0} credits</p>
          </header>

          {/* Credits Card */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Credits</CardTitle>
                <CardDescription>Balance and usage history for this account.</CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={() => { setCreditAmount(0); setCreditReason(''); setCreditDialog(true); }}>
                    Adjust Credits
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grant or deduct credits from this account</TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">Balance</p>
                  <p className="text-3xl font-bold">{client.credits ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">Total Spent</p>
                  <p className="text-3xl font-bold">€{(client.totalSpent || 0).toFixed(2)}</p>
                </div>
              </div>
              {auditLog.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className={`font-bold ${e.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {e.amount > 0 ? '+' : ''}{e.amount}
                        </TableCell>
                        <TableCell>{e.reason}</TableCell>
                        <TableCell className="text-slate-500">{e.adjustedBy}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Candidates Section */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle>Candidates</CardTitle>
                <CardDescription>Candidates linked to this client account.</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCandidateIds.size > 0 && (
                  <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-600 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-sm font-normal">
                    <span>{selectedCandidateIds.size} selected</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete selected
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Permanently delete selected candidates</TooltipContent>
                    </Tooltip>
                  </div>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={openManageCandidates}>
                      <Users className="w-4 h-4 mr-1" />Manage candidates
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Link or unlink candidates from this client</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={visibleCandidates.length === 0} aria-label="Export CSV">
                      <Download className="w-4 h-4 mr-1" />Export CSV
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export candidates as CSV</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <Input
                  className="max-w-sm"
                  placeholder="Search by name or email…"
                  value={candidateSearch}
                  onChange={e => setCandidateSearch(e.target.value)}
                />
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Switch id="show-archived-candidates" checked={showArchived} onCheckedChange={setShowArchived} />
                  <Label htmlFor="show-archived-candidates">Show archived</Label>
                </div>
              </div>

              {visibleCandidates.length === 0 ? (
                <p className="text-slate-400 py-8 text-center">No candidates.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          ref={headerCheckboxRef as any}
                          checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                          onCheckedChange={(checked) => {
                            const shouldSelect = checked === true || checked === 'indeterminate';
                            setSelectedCandidateIds(prev => toggleSelectAll(prev, visibleIds, shouldSelect));
                          }}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleCandidates.map(c => (
                      <TableRow key={c.id} className={c.archived ? 'opacity-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCandidateIds.has(c.id)}
                            onCheckedChange={(checked) => {
                              setSelectedCandidateIds(prev => toggleSelectRow(prev, c.id, !!checked));
                            }}
                            aria-label={`Select ${c.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {c.name || '—'}
                            {c.archived && <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-none text-xs">Archived</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500">{c.appliedRole || '—'}</TableCell>
                        <TableCell>{c.status || 'Pending'}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            (c.fitBadge || '').includes('Strong') ? 'bg-green-50 text-green-700 border-green-200' :
                            (c.fitBadge || '').includes('Conditional') ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }>{c.fitBadge || 'Unknown'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
                                  onClick={() => setEditCandidateDialog({ id: c.id, name: c.name || '', email: c.email || '', appliedRole: c.appliedRole || '' })}
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(c.id, 'Shortlisted')}
                                  disabled={c.status === 'Shortlisted'}
                                >
                                  Shortlist
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as Shortlisted</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteCandidate(c.id)}
                                  aria-label={`Delete ${c.name}`}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete candidate data (GDPR hard delete)</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Client Dialog */}
      <Dialog open={editClientDialog} onOpenChange={(o) => !o && setEditClientDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update {client.companyName || client.id}'s details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name (required)</Label>
              <Input
                id="edit-client-company"
                value={editCompany}
                onChange={e => setEditCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label>Email (required)</Label>
              <Input
                id="edit-client-email"
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="hello@acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label>VAT / Tax ID (optional)</Label>
              <Input
                id="edit-client-vat"
                value={editVat}
                onChange={e => setEditVat(e.target.value)}
                placeholder="e.g. DE123456789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClientDialog(false)}>Cancel</Button>
            <Button
              id="edit-client-save"
              onClick={handleEditClient}
              disabled={editClientSaving || !editClientValid}
            >
              {editClientSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Credits Dialog */}
      <Dialog open={creditDialog} onOpenChange={setCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>Grant or deduct credits for {client.email || client.id}. Balance: {client.credits ?? 0}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (positive to grant, negative to deduct)</Label>
              <Input type="number" value={creditAmount} onChange={e => setCreditAmount(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Input value={creditReason} onChange={e => setCreditReason(e.target.value)} placeholder="e.g., Courtesy credit" />
            </div>
            {creditAmount !== 0 && (
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm">
                New balance: <strong>{Math.max(0, (client.credits || 0) + creditAmount)}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(false)}>Cancel</Button>
            <Button onClick={handleCreditAdjust} disabled={creditSaving || creditAmount === 0 || !creditReason.trim()}>
              {creditSaving ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Dialog */}
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

      {/* Manage Candidates Dialog */}
      <Dialog open={manageCandidatesDialog} onOpenChange={(o) => !o && setManageCandidatesDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage candidates</DialogTitle>
            <DialogDescription>
              Check candidates to link them to {client.companyName || client.id}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <Input
              placeholder="Search by name or email…"
              value={manageSearch}
              onChange={e => setManageSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
              {loadingAllCandidates ? (
                <p className="text-slate-500 text-sm text-center py-6">Loading…</p>
              ) : filteredManageCandidates.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No candidates found.</p>
              ) : filteredManageCandidates.map(c => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <Checkbox
                    checked={managedMembership.has(c.id)}
                    onCheckedChange={(checked) => {
                      setManagedMembership(prev => {
                        const next = new Set(prev);
                        if (checked) next.add(c.id); else next.delete(c.id);
                        return next;
                      });
                    }}
                    aria-label={`Toggle ${c.name}`}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{c.name || '—'}</span>
                    <span className="text-xs text-slate-500">{c.email || ''}</span>
                  </span>
                </label>
              ))}
            </div>
            {manageProgress && (
              <p className="text-sm text-slate-500 text-center">{manageProgress}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageCandidatesDialog(false)} disabled={manageSaving}>Cancel</Button>
            <Button id="manage-candidates-save" onClick={handleManageSave} disabled={manageSaving || loadingAllCandidates}>
              {manageSaving ? (manageProgress || 'Saving…') : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
