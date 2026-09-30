import { useState, useEffect, useRef } from 'react';
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
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, ArrowRight, MoreVertical, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useI18n } from '@/contexts/I18nContext';
import { fitBadgeLabel, type TFn } from '@/lib/fitBadge';

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
export function buildCandidatesCsv(candidates: CandidateRecord[], t?: TFn): string {
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
    escape(t ? fitBadgeLabel(c.fitBadge, t) : c.fitBadge),
    escape(c.integrityFlag),
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

const ActionMenu = ({ onEdit, onTopUp, onDelete }: { onEdit: () => void, onTopUp: () => void, onDelete: () => void }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && buttonRef.current) {
      setRect(buttonRef.current.getBoundingClientRect());
    }
  }, [open]);

  useEffect(() => {
    const handleScroll = () => setOpen(false);
    if (open) {
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [open]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={buttonRef} variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("admin.tooltip.more_actions", "More actions")}</TooltipContent>
      </Tooltip>
      {open && rect && (
        <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div 
            className="absolute bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-md p-1 min-w-[120px] flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: rect.bottom + 4, right: window.innerWidth - rect.right }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm text-left w-full" onClick={() => { setOpen(false); onEdit(); }}>
                  <Edit2 className="w-4 h-4 text-slate-500" /> {t("admin.act.edit", "Edit")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("admin.tooltip.edit_org", "Edit this organization's details")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm text-left w-full" onClick={() => { setOpen(false); onTopUp(); }}>
                  <Plus className="w-4 h-4 text-slate-500" /> {t("admin.act.topup", "Top Up")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("admin.tooltip.add_credits", "Add credits to this organization's balance")}</TooltipContent>
            </Tooltip>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-sm text-left w-full" onClick={() => { setOpen(false); onDelete(); }}>
                  <Trash2 className="w-4 h-4 text-red-500" /> {t("admin.act.delete", "Delete")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("admin.tooltip.delete_org", "Permanently remove this organization and all its data")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </>
  );
};

export const AdminPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setTargetId } = useImpersonation();
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

  // Top Up Client state
  const [topUpDialog, setTopUpDialog] = useState(false);
  const [topUpClient, setTopUpClient] = useState<RecruiterAccount | null>(null);
  const [topUpCredits, setTopUpCredits] = useState(10);
  const [topUpReason, setTopUpReason] = useState('Admin manual top up');
  const [toppingUp, setToppingUp] = useState(false);

  // Delete Client state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteClientTarget, setDeleteClientTarget] = useState<RecruiterAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load recruiters + candidate counts
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const loaded: RecruiterAccount[] = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as RecruiterAccount & { role?: string }))
          .filter(u => u.role !== 'admin' && u.id !== user?.uid);
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

  const handleTopUp = async () => {
    if (!topUpClient || topUpCredits <= 0) return;
    setToppingUp(true);
    try {
      const adjustCredits = httpsCallable(functions, 'adjustClientCredits');
      await adjustCredits({
        clientId: topUpClient.id,
        amount: topUpCredits,
        reason: topUpReason
      });
      setRecruiters(prev => prev.map(r => r.id === topUpClient.id ? { ...r, credits: (r.credits || 0) + topUpCredits } : r));
      setTopUpDialog(false);
    } catch (err) {
      console.error(err);
      alert(t('admin.alert.failed_topup', 'Failed to top up credits.'));
    } finally {
      setToppingUp(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deleteClientTarget) return;
    setDeleting(true);
    try {
      const deleteCallable = httpsCallable(functions, 'deleteClient');
      await deleteCallable({ clientId: deleteClientTarget.id });
      setRecruiters(prev => prev.filter(r => r.id !== deleteClientTarget.id));
      setDeleteDialog(false);
    } catch (err) {
      console.error(err);
      alert(t('admin.alert.failed_delete', 'Failed to delete client.'));
    } finally {
      setDeleting(false);
    }
  };

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
      alert(t('adminpage.alert.11', 'Failed to add client.'));
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
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("admin.nav.back", "Back")}</Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>{t("admin.nav.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
          <ThemeToggle />
        </nav>
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold tracking-tight">{t('admin.title', 'Administrator Dashboard')}</h1>
                  <Badge className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-none">{t("admin.badge.admin", "Admin")}</Badge>
                </div>
              <p className="text-slate-500">{t('admin.description', 'Global overview of all PreSift customer accounts.')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Switch
                    id="show-archived"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                  />
                  <Label htmlFor="show-archived">{t("admin.show_archived", "Show archived")}</Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t("admin.tooltip.show_archived", "Show or hide archived organizations")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setAddClientDialog(true)}>{t("admin.add_client", "Add Client")}</Button>
              </TooltipTrigger>
              <TooltipContent>{t("admin.tooltip.create_org", "Create a new organization account")}</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t('admin.stat.total_customers', 'Total Customers'), value: recruiters.length },
            { label: t('admin.stat.credits_outstanding', 'Credits Outstanding'), value: totalCreds },
            { label: t('admin.stat.total_revenue', 'Total Revenue'), value: `€${totalRev.toFixed(2)}` },
          ].map((s, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="pb-2"><CardDescription className="text-xs uppercase tracking-wider font-semibold">{s.label}</CardDescription></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? t('admin.loading_value', '...') : s.value}</p></CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.customer_accounts", "Customer Accounts")}</CardTitle>
            <CardDescription>{t("admin.customer_accounts_desc", "Click any row to view the client detail page.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-slate-500 py-8 text-center">{t('admin.loading', 'Loading...')}</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t('admin.table.account', 'Account ID')}</TableHead><TableHead>{t('admin.table.email', 'Email')}</TableHead><TableHead>{t('admin.table.company', 'Company')}</TableHead>
                  <TableHead>{t('admin.table.vat', 'VAT ID')}</TableHead><TableHead className="text-right">{t('admin.table.credits', 'Credits')}</TableHead>
                  <TableHead className="text-right">{t('admin.table.spent', 'Spent')}</TableHead>
                  <TableHead className="text-right">{t('admin.table.candidates', 'Candidates')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
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
                            <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-none text-xs">{t("admin.badge.archived", "Archived")}</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{r.vatId || '—'}</TableCell>
                      <TableCell className="text-right font-bold">{r.credits ?? 0}</TableCell>
                      <TableCell className="text-right text-slate-500">€{(r.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-slate-500 text-sm">
                        {r.archived ? '–' : (candidateCounts[r.id] !== undefined ? String(candidateCounts[r.id]) : '…')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetId(r.id);
                                  navigate('/dashboard');
                                }}
                              >
                                <Eye className="h-4 w-4 text-blue-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("admin.tooltip.impersonate", "Impersonate this recruiter")}</TooltipContent>
                          </Tooltip>
                          <ActionMenu 
                            onEdit={() => navigate(`/admin/clients/${r.id}`)}
                            onTopUp={() => { setTopUpClient(r); setTopUpCredits(10); setTopUpReason('Admin manual top up'); setTopUpDialog(true); }}
                            onDelete={() => { setDeleteClientTarget(r); setDeleteDialog(true); }}
                          />
                        </div>
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
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("admin.add_client_title", "Add New Client")}</DialogTitle>
              <DialogDescription>{t("admin.add_client_desc", "Create a new customer account and grant initial credits.")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("admin.full_name_req", "Full Name (required)")}</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('admin.placeholder.full_name', 'e.g. Jane Doe')} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.company_name_req", "Company Name (required)")}</Label>
                <Input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder={t('admin_client.placeholder.company', 'e.g. Acme Corp')} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.email_req", "Email (required)")}</Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('admin_client.placeholder.email', 'hello@acme.com')} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.vat_req", "VAT/Tax ID (optional)")}</Label>
                <Input value={newVat} onChange={e => setNewVat(e.target.value)} placeholder={t('admin_client.placeholder.vat', 'e.g. DE123456789')} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.free_credits", "Free credits for promo/testing")}</Label>
                <Input type="number" min="0" value={newCredits} onChange={e => setNewCredits(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.reason", "Reason")}</Label>
                <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder={t('admin.placeholder.promo', 'e.g., Promo / testing')} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddClientDialog(false)}>{t("common.cancel", "Cancel")}</Button>
              <Button
                onClick={handleAddClient}
                disabled={addingClient || !newName.trim() || !newCompany.trim() || !newEmail.trim() || newCredits < 0}
              >
                {addingClient ? <Spinner size="sm" className="mr-2" /> : null}
                {addingClient ? t('admin.btn.saving', 'Saving...') : t('admin.btn.create_client', 'Create Client')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Top Up Dialog */}
        <Dialog open={topUpDialog} onOpenChange={setTopUpDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.top_up_title", "Top Up Credits")}</DialogTitle>
              <DialogDescription>{t("admin.dialog.add_credits_desc", "Add assessment credits to {companyName}.").replace("{companyName}", topUpClient?.companyName || "")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("admin.credits_to_add", "Credits to Add")}</Label>
                <Input type="number" min="1" value={topUpCredits} onChange={e => setTopUpCredits(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.reason", "Reason")}</Label>
                <Input value={topUpReason} onChange={e => setTopUpReason(e.target.value)} placeholder={t('admin.placeholder.promo2', 'e.g. promotional')} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTopUpDialog(false)}>{t("common.cancel", "Cancel")}</Button>
              <Button
                onClick={handleTopUp}
                disabled={toppingUp || topUpCredits <= 0}
              >
                {toppingUp ? <Spinner size="sm" className="mr-2" /> : null}
                {toppingUp ? t('admin.btn.saving', 'Saving...') : t('admin.act.topup', 'Top Up')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.delete_title", "Delete Client Account")}</DialogTitle>
              <DialogDescription className="text-red-600 dark:text-red-400 font-medium">
                {t("admin.delete_warning", "Warning: This action is permanent and irreversible.")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-slate-600 dark:text-slate-400">
              {t("admin.delete_confirm", "Are you sure you want to completely delete {name}?").replace('{name}', deleteClientTarget?.companyName || '')}
              <br /><br />
              {t("admin.delete_cascade", "This will cascade and permanently delete all of their candidates, campaigns, and credit history.")}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(false)}>{t("common.cancel", "Cancel")}</Button>
              <Button
                variant="destructive"
                onClick={handleDeleteClient}
                disabled={deleting}
              >
                {deleting ? <Spinner size="sm" className="mr-2" /> : null}
                {deleting ? t('admin.btn.deleting', 'Deleting...') : t('admin.btn.delete_permanently', 'Delete Permanently')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        </div>
      </main>
    </div>
  );
};
