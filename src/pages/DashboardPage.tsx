import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Edit, Copy, Trash2, Archive, ArchiveRestore, ArrowLeft, ArrowRight, Zap, Check } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, LabelList, BarChart, Bar, Legend } from 'recharts';
import { fitBadgeLabel } from '@/lib/fitBadge';
import { calculatePearsonCorrelation, getCorrelationDescriptor } from '@/lib/psychometrics';

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
  const { t } = useI18n();
  const { user, role } = useAuth();
  const { targetId } = useImpersonation();
  const recruiterId = targetId || user?.uid || '';
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
  const [generatedLinkData, setGeneratedLinkData] = useState<{url: string} | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkLang, setLinkLang] = useState<'el' | 'en'>('el');
  const [linkPurpose, setLinkPurpose] = useState<'hire' | 'benchmark'>('hire');
  const [performanceRating, setPerformanceRating] = useState<string>('');
  const [dialogCandidateName, setDialogCandidateName] = useState<string>('');
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [teamBenchmarkOpen, setTeamBenchmarkOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ name: string; email: string; rating: string }[]>([
    { name: '', email: '', rating: '' },
    { name: '', email: '', rating: '' },
    { name: '', email: '', rating: '' }
  ]);
  const [teamLinksGenerated, setTeamLinksGenerated] = useState<{ name: string; email: string; rating: number; url: string }[] | null>(null);
  const [teamCopied, setTeamCopied] = useState(false);
  const [creatingTeamLinks, setCreatingTeamLinks] = useState(false);
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
      if (!recruiterId) {
        setLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', recruiterId));
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

        const q = query(collection(db, 'candidates'), where('recruiterId', '==', recruiterId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCandidates(list);

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

  // Benchmark correlation data: completed candidates with purpose === 'benchmark' & performanceRating
  const completedBenchmarkCandidates = candidates.filter(
    c => c.purpose === 'benchmark' && typeof c.performanceRating === 'number' && c.scoreResult
  );

  const benchmarkPairs = completedBenchmarkCandidates.map(c => {
    // preSift scaled index (1-10): blend of ICAR (cognitive percentile / 10) and WLEIS (total / 16 * 10 or scaled)
    const icarVal = (c.scoreResult?.icar?.percentile ?? 50) / 10; // 0-10
    const wleisRaw = c.scoreResult?.wleis?.rawScores?.Total ?? 48; // max ~64
    const wleisVal = Math.min(10, Math.max(1, (wleisRaw / 64) * 10)); // 0-10
    const blended = Math.round(((icarVal * 0.6 + wleisVal * 0.4) || 5) * 10) / 10;
    return {
      name: c.name,
      managerRating: Number(c.performanceRating),
      presiftScore: blended
    };
  });

  const benchmarkCorrelation = calculatePearsonCorrelation(benchmarkPairs);
  const correlationDesc = getCorrelationDescriptor(benchmarkCorrelation);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    const shouldSelect = checked === true || checked === 'indeterminate';
    setSelectedCandidateIds(prev => toggleSelectAll(prev, filteredCandidateIds, shouldSelect));
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedCandidateIds(prev => toggleSelectRow(prev, id, checked));
  };

  const handleBulkDelete = async () => {
    if (selectedCandidateIds.size === 0) return;
    if (confirm(t('dashboard.confirm.bulk_delete', 'Are you sure you want to delete {size} candidate(s)? This cannot be undone.').replace('{size}', selectedCandidateIds.size.toString()))) {
      setDeletingBulk(true);
      try {
        const bulkDelete = httpsCallable(functions, 'bulkDeleteCandidates');
        await bulkDelete({ candidateIds: Array.from(selectedCandidateIds) });
        setCandidates(prev => prev.filter(c => !selectedCandidateIds.has(c.id)));
        setSelectedCandidateIds(new Set());
      } catch (e) {
        alert(t('dashboardpage.alert.1', 'Failed to delete candidates.'));
        console.error(e);
      } finally {
        setDeletingBulk(false);
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
    setSavingEdit(true);
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
      alert(t('dashboard.alert.failed_edit', 'Failed to edit candidate.'));
      console.error(e);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleArchiveCandidate = async (c: any) => {
    const newArchived = !c.archived;
    setArchivingId(c.id);
    try {
      const archiveCandidate = httpsCallable(functions, 'archiveCandidate');
      await archiveCandidate({ candidateId: c.id, archived: newArchived });
      setCandidates(prev => prev.map(x => x.id === c.id ? { ...x, archived: newArchived } : x));
    } catch (e) {
      alert(t('dashboard.alert.failed_archive', 'Failed to archive/unarchive candidate.'));
      console.error(e);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDeleteCandidate = async (c: any) => {
    if (!window.confirm(t('dashboard.confirm.delete', 'Are you sure you want to permanently delete candidate {name}?').replace('{name}', c.name))) return;
    setDeletingId(c.id);
    try {
      const deleteCandidateCallable = httpsCallable(functions, 'deleteCandidate');
      await deleteCandidateCallable({ candidateId: c.id });
      setCandidates(prev => prev.filter(x => x.id !== c.id));
    } catch (e) {
      alert(t('dashboard.alert.failed_delete', 'Failed to delete candidate.'));
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };


  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
        <nav className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 sticky top-0 z-40 px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("dashboard.tooltip.back", "Go back to the previous page")}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => navigate(1)}>
                  Forward <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("dashboard.tooltip.forward", "Go forward to the next page")}</TooltipContent>
            </Tooltip>
          </div>
          <ThemeToggle />
        </nav>
        
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">

            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title', 'Recruiter Dashboard')}</h1>
                <p className="text-slate-500">{t('dashboard.description', 'Manage assessments and review candidates.')}</p>
<p className="text-slate-500">{t("dashboard.recruiter", "Recruiter: ")}{recruiterIdentifier}</p>
              </div>
            </div>
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">{t("dashboard.balance", "Balance")}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-bold text-lg text-slate-900 dark:text-white cursor-help">
                  {loading ? '...' : `${balance} ${t("dashboard.credits", "Credits")}`}
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("dashboard.tooltip.credits", "Credits remaining — each assessment link costs 1 credit")}</TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => navigate('/pricing')}>{t("dashboard.topup", "Top Up Credits")}</Button>
            </TooltipTrigger>
            <TooltipContent>{t("dashboard.tooltip.topup", "Buy more assessment credits — opens the payment page")}</TooltipContent>
          </Tooltip>
        </div>
        </header>
      
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-9" 
            placeholder={t("dashboard.search", "Search candidates by name, role, or status...")} 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Switch id="show-archived-dash" checked={showArchived} onCheckedChange={setShowArchived} />
                <Label htmlFor="show-archived-dash">{t("dashboard.show_archived", "Show archived")}</Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("dashboard.tooltip.archived", "Show or hide archived candidates")}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium"
                onClick={() => setTeamBenchmarkOpen(true)}
              >
                <Zap className="w-4 h-4 mr-2" />
                {t("dashboard.benchmark.btn", "⚡ Team Benchmark (POC)")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("dashboard.benchmark.btn_tooltip", "Launch team benchmark workflow for top performers")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => {
                // Reset the dialog so a previous benchmark study never leaks into
                // the next link (stale purpose + stale rating = wrong data).
                setLinkPurpose('hire');
                setPerformanceRating('');
                setDialogCandidateName('');
                setCreateLinkDialogOpen(true);
              }}>{t("dashboard.create_assessment", "+ Create New Assessment")}</Button>
            </TooltipTrigger>
            <TooltipContent>{t("dashboard.tooltip.generate", "Generate an assessment link to send to a candidate")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("dashboard.recent_candidates", "Recent Candidates")}</CardTitle>
              <CardDescription>{t("dashboard.recent_desc", "Overview of recent applicants.")}</CardDescription>
            </div>
            {selectedCandidateIds.size > 0 && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-600 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">
                <span className="text-sm font-medium">{selectedCandidateIds.size} {t("dashboard.text.selected", "selected")}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={deletingBulk}>
                      {deletingBulk ? <Spinner size="sm" className="mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      {t("dashboard.btn.delete_selected", "Delete selected")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("dashboard.tooltip.delete_bulk", "Permanently remove the selected candidates")}</TooltipContent>
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
                      aria-label={t("dashboard.aria.select_all", "Select all")}
                    />
                  </TableHead>
                  <TableHead>{t('dashboard.table.candidate', 'Candidate')}</TableHead>
                  <TableHead>{t("dashboard.table.role", "Role")}</TableHead>
                  <TableHead>{t('dashboard.table.status', 'Status')}</TableHead>
                  <TableHead>{t('dashboard.table.date', 'Date')}</TableHead>
                  <TableHead>{t('dashboard.table.score', 'Fit Score')}</TableHead>
                  <TableHead>{t("dashboard.table.integrity", "Integrity")}</TableHead>
                  <TableHead className="text-right">{t('dashboard.table.actions', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <Spinner className="mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredCandidates.map((c) => (
                  <TableRow key={c.id} className={c.archived ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedCandidateIds.has(c.id)}
                        onCheckedChange={(checked) => handleSelectRow(c.id, !!checked)}
                        aria-label={`${t("dashboard.aria.select", "Select")} ${c.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {c.name}
                        {c.purpose === 'benchmark' && (
                          <Badge variant="outline" className="text-xs">
                            {t("dashboard.badge.benchmark", "Benchmark · {{rating}}/10").replace("{{rating}}", String(c.performanceRating ?? ""))}
                          </Badge>
                        )}
                        {c.archived && <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-none text-xs">{t("dashboard.badge.archived", "Archived")}</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {c.roleTitle || c.appliedRole}
                    </TableCell>
                    <TableCell>{t(`status.${(c.status || 'pending').toLowerCase()}`, c.status || 'Pending')}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        (c.fitBadge || c.fit || '').includes('Strong') ? 'bg-green-50 text-green-700 border-green-200' :
                        (c.fitBadge || c.fit || '').includes('Conditional') ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }>
                        {c.fitBadge || c.fit ? fitBadgeLabel(c.fitBadge || c.fit, t) : t("dashboard.badge.unknown", "Unknown")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.integrityEvents?.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="destructive" className="cursor-help">⚠️ {t("dashboard.badge.flagged", "Flagged")}</Badge>
                          </TooltipTrigger>
                          <TooltipContent>{t("dashboard.tooltip.flagged", "Candidate flagged by anti-cheating monitoring")}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-slate-400 text-sm">{t("dashboard.badge.clear", "Clear")}</span>
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
                            aria-label={`${t("dashboard.aria.copy_link", "Copy link for")} ${c.name}`}
                          >
                            {copiedId === c.id ? (
                              <span className="text-xs font-semibold text-green-600">{t("dashboard.badge.copied", "Copied")}</span>
                            ) : (
                              <Copy className="w-4 h-4 text-slate-500" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{c.archived ? t('dashboard.tooltip.copy_disabled', 'Cannot copy link for archived candidate') : t('dashboard.tooltip.copy', 'Copy assessment link')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditCandidateDialog({ id: c.id, name: c.name || '', email: c.email || '', appliedRole: c.roleTitle || c.appliedRole || '' })} 
                            aria-label={`${t("dashboard.aria.edit", "Edit")} ${c.name}`}
                          >
                            <Edit className="w-4 h-4 text-slate-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("dashboard.tooltip.edit", "Edit this candidate's details")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={archivingId === c.id}
                            onClick={() => handleArchiveCandidate(c)}
                            aria-label={c.archived ? `${t("dashboard.aria.unarchive", "Unarchive")} ${c.name}` : `${t("dashboard.aria.archive", "Archive")} ${c.name}`}
                          >
                            {archivingId === c.id ? <Spinner size="sm" /> : c.archived
                              ? <ArchiveRestore className="w-4 h-4 text-slate-500" />
                              : <Archive className="w-4 h-4 text-slate-500" />
                            }
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{c.archived ? t('dashboard.tooltip.unarchive', 'Restore this candidate from the archive') : t('dashboard.tooltip.archive', 'Move this candidate to the archive')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === c.id}
                            onClick={() => handleDeleteCandidate(c)}
                            aria-label={`${t("dashboard.aria.delete", "Delete")} ${c.name}`}
                          >
                            {deletingId === c.id ? <Spinner size="sm" className="text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("dashboard.tooltip.delete_bulk", "Permanently remove the selected candidates")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/candidate/${c.id}`)}>{t("dashboard.btn.view", "View")}</Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("dashboard.tooltip.view", "Open this candidate's full profile and results")}</TooltipContent>
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
            <CardTitle>{t("dashboard.benchmarking", "Candidate Benchmarking")}</CardTitle>
            <CardDescription>{t("dashboard.chart.desc", "ICAR (Cognitive) vs WLEIS (Emotional Intelligence) Score Distribution")}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="icar" name="ICAR Percentile" unit="%ile" domain={[0, 100]} />
                <YAxis type="number" dataKey="wleis" name="WLEIS Score" domain={[16, 112]} />
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-slate-900 border p-2 rounded shadow-sm text-xs">
                        <p className="font-semibold">{data.name}</p>
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

        {/* Team Benchmark Correlation Card */}
        {completedBenchmarkCandidates.length > 0 && (
          <Card className="shadow-sm mt-6 border-blue-500/20 bg-blue-50/10 dark:bg-blue-950/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500" />
                  {t("dashboard.benchmark.chart_title", "Team Benchmark: Manager Rating vs preSift Score")}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.benchmark.chart_desc", "Side-by-side comparison of manager ratings and preSift cognitive/EI scores.")}
                </CardDescription>
              </div>
              <div className="text-right">
                {benchmarkCorrelation !== null ? (
                  <div className="inline-flex flex-col items-end">
                    <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1">
                      {correlationDesc.percent}% {t("dashboard.benchmark.correlation_badge", "Statistical Match")}
                    </Badge>
                    <span className="text-xs text-slate-500 mt-1">{correlationDesc.label}</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 max-w-[200px] text-right inline-block">
                    {t("dashboard.benchmark.insufficient_text", "Need at least 3 completed benchmark assessments to compute correlation.")}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benchmarkPairs} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                  <ChartTooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-slate-900 border p-2 rounded shadow-sm text-xs">
                          <p className="font-semibold">{label}</p>
                          <p className="text-blue-600 dark:text-blue-400">
                            Manager Rating: {payload[0]?.value}/10
                          </p>
                          <p className="text-emerald-600 dark:text-emerald-400">
                            preSift Index: {payload[1]?.value}/10
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Legend />
                  <Bar dataKey="managerRating" name="Manager Rating (1-10)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="presiftScore" name="preSift Scaled Score (1-10)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createLinkDialogOpen} onOpenChange={setCreateLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.links", "Assessment Links")}</DialogTitle>
            <DialogDescription>{t("dashboard.dialog.links_desc", "Generate links to send to candidates.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-2">
              <Input 
                placeholder={t("dashboard.candidate_name", "Candidate Name")} 
                id="candidateNameInput"
                value={dialogCandidateName}
                onChange={(e) => setDialogCandidateName(e.target.value)}
              />
              <Input 
                placeholder={t("dashboard.candidate_email", "Candidate Email (optional)")} 
                id="candidateEmailInput"
                type="email"
              />
              <div className="flex flex-col gap-1.5">
                <Label>{t("dashboard.label.purpose", "Assessment Purpose")}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={linkPurpose === 'hire' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLinkPurpose('hire')}
                  >
                    {t("dashboard.option.purpose_hire", "Candidate hiring")}
                  </Button>
                  <Button
                    type="button"
                    variant={linkPurpose === 'benchmark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLinkPurpose('benchmark')}
                  >
                    {t("dashboard.option.purpose_benchmark", "Internal benchmark study")}
                  </Button>
                </div>
              </div>
              {linkPurpose === 'benchmark' && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-slate-500">
                    {t("dashboard.benchmark.explainer", "Use this option for existing employees taking part in an internal benchmark study. The performance rating is recorded before the assessment is completed and is permanently locked.")}
                  </p>
                  <Label htmlFor="performanceRatingInput">
                    {t("dashboard.benchmark.rating_label", "Performance rating for {{name}} (1-10)").replace(
                      "{{name}}",
                      dialogCandidateName.trim() || t("dashboard.benchmark.name_fallback", "the employee")
                    )}
                  </Label>
                  <Input
                    id="performanceRatingInput"
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    required
                    value={performanceRating}
                    onChange={(e) => setPerformanceRating(e.target.value)}
                  />
                  <span className="text-xs text-slate-500">
                    {t("dashboard.benchmark.anchors", "1 = πολύ χαμηλή, 10 = εξαιρετική")}
                  </span>
                </div>
              )}
              <Input 
                placeholder={t("dashboard.role_title", "Role Title (e.g., Software Engineer)")} 
                id="roleTitleInput"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("dashboard.label.language", "Candidate Language")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={linkLang === 'el' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLinkLang('el')}
                >
                  {t("dashboard.option.el", "Ελληνικά")}
                </Button>
                <Button
                  type="button"
                  variant={linkLang === 'en' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLinkLang('en')}
                >
                  {t("dashboard.option.en", "English")}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setCreateLinkDialogOpen(false)}>{t("common.cancel", "Cancel")}</Button>
              </TooltipTrigger>
              <TooltipContent>{t("dashboard.tooltip.cancel_link", "Close this dialog without creating a link")}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={
                    creatingLink ||
                    (balance <= 0 && role !== 'admin') ||
                    (linkPurpose === 'benchmark' &&
                      (performanceRating.trim() === '' ||
                        !Number.isInteger(Number(performanceRating)) ||
                        Number(performanceRating) < 1 ||
                        Number(performanceRating) > 10))
                  }
                  onClick={async () => {
                  const roleTitle = (document.getElementById('roleTitleInput') as HTMLInputElement).value;
                  const candidateName = (document.getElementById('candidateNameInput') as HTMLInputElement).value;
                  const candidateEmail = (document.getElementById('candidateEmailInput') as HTMLInputElement).value;
                  if (!roleTitle) return alert(t('dashboard.alert.enter_role', 'Enter a role title'));
                  if (linkPurpose === 'benchmark') {
                    const num = Number(performanceRating);
                    if (performanceRating.trim() === '' || !Number.isInteger(num) || num < 1 || num > 10) {
                      return alert(t('dashboard.benchmark.rating_error', 'Enter an integer between 1 and 10.'));
                    }
                  }
                  setCreatingLink(true);
                  try {
                const createLink = httpsCallable(functions, 'createAssessmentLink');
                const payload: Record<string, any> = { roleTitle, candidateName, candidateEmail, recruiterId, lang: linkLang, purpose: linkPurpose };
                if (linkPurpose === 'benchmark') {
                  payload.performanceRating = Number(performanceRating);
                }
                const res = await createLink(payload);
                const data = res.data as any;
                if (role !== 'admin') {
                  setBalance(b => b - 1);
                }
                setGeneratedLinkData({ url: data.url });
                if (data.emailStatus === 'failed') {
                  alert(t('dashboard.alert.email_failed', 'Link created, but the invitation e-mail could not be sent. Copy the link and send it yourself.'));
                } else if (data.emailStatus && String(data.emailStatus).startsWith('skipped')) {
                  alert(t('dashboard.alert.email_capped', 'Link created. The e-mail was not sent because the daily e-mail limit is reached. Copy the link and send it yourself.'));
                }
                setCreateLinkDialogOpen(false);
                setLinkPurpose('hire');
                setPerformanceRating('');
                setDialogCandidateName('');
              } catch (e: any) {
                console.error(e);
                if (e.code === 'functions/failed-precondition') {
                  alert(t('dashboard.alert.insufficient', 'Insufficient credits — top up this recruiter to create a link.'));
                } else if (e.code === 'functions/permission-denied') {
                  alert(t('dashboard.alert.no_permission', 'No permission to create links for this account.'));
                } else if (e.code === 'functions/unauthenticated') {
                  alert(t('dashboard.alert.sign_in', 'Please sign in to create a link.'));
                } else {
                  alert(t('dashboard.alert.failed_link', 'Failed to create link.'));
                }
              } finally {
                setCreatingLink(false);
              }
            }}>
              {creatingLink ? <Spinner size="sm" className="mr-2" /> : null}
              {(balance <= 0 && role !== 'admin') ? t("dashboard.btn.out_of_credits", "Out of Credits - Top Up to Create") : t("dashboard.btn.generate_link", "Generate Assessment Link")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("dashboard.tooltip.create_copy", "Create the link and copy it — costs 1 credit")}</TooltipContent>
        </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!generatedLinkData} onOpenChange={(o) => !o && setGeneratedLinkData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.dialog.link_created", "Assessment Link Created")}</DialogTitle>
            <DialogDescription>{t("dashboard.dialog.share_desc", "Share this link with your candidate.")}</DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center gap-4">
            <p className="text-center font-mono bg-slate-100 dark:bg-slate-900 p-4 rounded text-sm break-all select-all w-full border border-slate-200 dark:border-slate-800">
              {generatedLinkData?.url}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="w-full"
                  variant={linkCopied ? 'outline' : 'default'}
                  onClick={() => {
                    if (generatedLinkData) {
                      navigator.clipboard.writeText(generatedLinkData.url);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }
                  }}
                >
                  {linkCopied ? t("dashboard.btn.copied", "Copied!") : t("dashboard.btn.copy_clipboard", "Copy to Clipboard")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("dashboard.tooltip.copy_share", "Copy the link to share with the candidate")}</TooltipContent>
            </Tooltip>
          </div>
          <DialogFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={() => setGeneratedLinkData(null)}>{t("common.close", "Close")}</Button>
              </TooltipTrigger>
              <TooltipContent>{t("dashboard.tooltip.close_popup", "Close this popup")}</TooltipContent>
            </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!editCandidateDialog} onOpenChange={(o) => !o && setEditCandidateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.edit_candidate", "Edit Candidate")}</DialogTitle>
            <DialogDescription>{t("dashboard.dialog.edit_desc", "Update the candidate's details.")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCandidate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("dashboard.label.candidate_name", "Candidate Name")}</Label>
                <Input 
                  value={editCandidateDialog?.name || ''} 
                  onChange={e => setEditCandidateDialog({ ...editCandidateDialog, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("dashboard.label.candidate_email", "Candidate Email")}</Label>
                <Input 
                  type="email"
                  value={editCandidateDialog?.email || ''} 
                  onChange={e => setEditCandidateDialog({ ...editCandidateDialog, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("dashboard.label.applied_role", "Applied Role")}</Label>
                <Input 
                  value={editCandidateDialog?.appliedRole || ''} 
                  onChange={e => setEditCandidateDialog({ ...editCandidateDialog, appliedRole: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditCandidateDialog(null)}>{t("common.cancel", "Cancel")}</Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="submit" disabled={savingEdit}>
                    {savingEdit ? <Spinner size="sm" className="mr-2" /> : null}
                    {t("dashboard.btn.save_changes", "Save Changes")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("dashboard.tooltip.save_edit", "Save the candidate's updated details")}</TooltipContent>
              </Tooltip>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Team Benchmark Setup Modal */}
      <Dialog open={teamBenchmarkOpen} onOpenChange={setTeamBenchmarkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              {t("dashboard.benchmark.modal_title", "Benchmark Your Team (Proof of Concept)")}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.benchmark.modal_desc", "Test preSift against the known performance of your current team members. Rate 3-5 members (1-10) and generate their direct links.")}
            </DialogDescription>
          </DialogHeader>

          {teamLinksGenerated ? (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900 text-sm text-blue-700 dark:text-blue-300">
                {t("dashboard.benchmark.links_ready_desc", "Send these links to your team members to take their 10-minute assessment:")}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {teamLinksGenerated.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded border text-xs gap-3">
                    <div className="font-medium truncate min-w-[120px]">
                      {item.name} <span className="text-slate-400">({item.rating}/10)</span>
                    </div>
                    <div className="truncate font-mono text-slate-500 flex-1">{item.url}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(item.url);
                        alert(`Copied link for ${item.name}!`);
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      {t("common.copy", "Copy")}
                    </Button>
                  </div>
                ))}
              </div>
              <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTeamLinksGenerated(null);
                    setTeamBenchmarkOpen(false);
                  }}
                >
                  {t("common.close", "Close")}
                </Button>
                <Button
                  onClick={() => {
                    const allLinksText = teamLinksGenerated
                      .map(item => `${item.name} (${item.rating}/10): ${item.url}`)
                      .join('\n');
                    navigator.clipboard.writeText(allLinksText);
                    setTeamCopied(true);
                    setTimeout(() => setTeamCopied(false), 2500);
                  }}
                >
                  {teamCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {teamCopied ? t("dashboard.benchmark.copied_all", "Copied All Links!") : t("dashboard.benchmark.copy_all", "Copy All Links")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                {teamMembers.map((member, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder={t("dashboard.benchmark.name_th", "Name")}
                      className="flex-1"
                      value={member.name}
                      onChange={(e) => {
                        const copy = [...teamMembers];
                        copy[idx].name = e.target.value;
                        setTeamMembers(copy);
                      }}
                    />
                    <Input
                      placeholder={t("dashboard.benchmark.email_th", "Email (optional)")}
                      className="flex-1"
                      type="email"
                      value={member.email}
                      onChange={(e) => {
                        const copy = [...teamMembers];
                        copy[idx].email = e.target.value;
                        setTeamMembers(copy);
                      }}
                    />
                    <Input
                      placeholder="Rating (1-10)"
                      className="w-28 text-center"
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={member.rating}
                      onChange={(e) => {
                        const copy = [...teamMembers];
                        copy[idx].rating = e.target.value;
                        setTeamMembers(copy);
                      }}
                    />
                    {teamMembers.length > 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 h-9 w-9 p-0"
                        onClick={() => {
                          setTeamMembers(teamMembers.filter((_, i) => i !== idx));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {teamMembers.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTeamMembers([...teamMembers, { name: '', email: '', rating: '' }]);
                  }}
                >
                  {t("dashboard.benchmark.add_row", "+ Add Team Member")}
                </Button>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setTeamBenchmarkOpen(false)}>
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button
                  disabled={
                    creatingTeamLinks ||
                    teamMembers.some(m => !m.name.trim() || !m.rating.trim() || Number(m.rating) < 1 || Number(m.rating) > 10)
                  }
                  onClick={async () => {
                    setCreatingTeamLinks(true);
                    try {
                      const createLink = httpsCallable(functions, 'createAssessmentLink');
                      const results: { name: string; email: string; rating: number; url: string }[] = [];

                      for (const member of teamMembers) {
                        const payload: Record<string, any> = {
                          roleTitle: 'Team Benchmark',
                          candidateName: member.name.trim(),
                          candidateEmail: member.email.trim() || undefined,
                          recruiterId,
                          lang: linkLang,
                          purpose: 'benchmark',
                          performanceRating: Number(member.rating)
                        };
                        const res = await createLink(payload);
                        const data = res.data as any;
                        results.push({
                          name: member.name.trim(),
                          email: member.email.trim(),
                          rating: Number(member.rating),
                          url: data.url
                        });
                      }

                      setTeamLinksGenerated(results);
                    } catch (err) {
                      console.error('Failed generating team benchmark links:', err);
                      alert(t('dashboardpage.alert.failed_benchmark_links', 'Failed generating team benchmark links. Check credits or connection.'));
                    } finally {
                      setCreatingTeamLinks(false);
                    }
                  }}
                >
                  {creatingTeamLinks ? <Spinner size="sm" className="mr-2" /> : null}
                  {t("dashboard.benchmark.generate_btn", "Generate Team Assessment Links")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
};
