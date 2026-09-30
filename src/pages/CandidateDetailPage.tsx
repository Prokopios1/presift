import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
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

// ── Interpretation helpers ───────────────────────────────────────────────────

type TFn = (key: string, fallback?: string) => string;


function icarPercentileLabel(p: number, t: TFn): string {
  if (p >= 90) return t('candidate_detail.icar.well_above_average', 'Well above average');
  if (p >= 75) return t('candidate_detail.icar.above_average', 'Above average');
  if (p >= 50) return t('candidate_detail.icar.average', 'Average');
  if (p >= 25) return t('candidate_detail.icar.below_average', 'Below average');
  return t('candidate_detail.icar.well_below_average', 'Well below average');
}

function icarPercentileSentence(p: number, t: TFn): string {
  const pct = Math.round(p);
  return t('candidate_detail.icar.performs_better', 'Performs better than {pct}% of the reference group on reasoning tasks.').replace('{pct}', String(pct));
}

function icarDomainLabel(score: number, t: TFn): string {
  if (score >= 3) return t('candidate_detail.domain.strong', 'Strong');
  if (score === 2) return t('candidate_detail.domain.moderate', 'Moderate');
  return t('candidate_detail.domain.weak', 'Weak');
}

function icarDomainColor(score: number): string {
  if (score >= 3) return 'text-emerald-600 dark:text-emerald-400';
  if (score === 2) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function wleisLabel(total: number, t: TFn): string {
  if (total >= 59) return t('candidate_detail.wleis.above_mid', 'Above the mid-range');
  if (total >= 38) return t('candidate_detail.wleis.around_mid', 'Around the mid-range');
  return t('candidate_detail.wleis.below_mid', 'Below the mid-range');
}

function wleisSentence(total: number, t: TFn): string {
  if (total >= 59)
    return t('candidate_detail.wleis.desc_strong', 'Reports strong emotional awareness and regulation relative to the norm group.');
  if (total >= 38)
    return t('candidate_detail.wleis.desc_mod', 'Reports moderate emotional intelligence — in line with most professionals.');
  return t('candidate_detail.wleis.desc_low', 'Reports lower emotional intelligence; explore specific subscales in the interview.');
}

function wleisSubscaleLabel(score: number, t: TFn): string {
  if (score >= 15) return t('candidate_detail.wleis.high', 'High');
  if (score >= 10) return t('candidate_detail.wleis.moderate', 'Moderate');
  return t('candidate_detail.wleis.low', 'Low');
}

function wleisSubscaleColor(score: number): string {
  if (score >= 15) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function fitBadgeSentence(badge: string, t: TFn): string {
  if (badge?.includes('Strong'))
    return t('candidate_detail.fit.strong', 'Strong overall match — reasoning and EI align well with role demands.');
  if (badge?.includes('Conditional'))
    return t('candidate_detail.fit.moderate', 'Moderate match — explore specific areas in the interview.');
  return t('candidate_detail.fit.weak', 'Weak overall match — probe carefully before advancing.');
}

// ── Component ────────────────────────────────────────────────────────────────

export const CandidateDetailPage = () => {
  const { t } = useI18n();
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { fromAdmin?: boolean; clientId?: string } | null;
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    if (state?.fromAdmin && state?.clientId) {
      navigate(`/admin/clients/${state.clientId}`);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

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
      alert(t('candidatedetailpage.alert.12', 'Failed to update status'));
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('candidatedetailpage.confirm.14', 'Are you sure you want to permanently delete this candidate (GDPR)? This cannot be undone.'))) {
      try {
        const deleteCandidate = httpsCallable(functions, 'deleteCandidate');
        await deleteCandidate({ candidateId: id });
        navigate('/dashboard');
      } catch (e) {
        alert(t('candidatedetailpage.alert.13', 'Failed to delete candidate.'));
        console.error(e);
      }
    }
  };

  const getDynamicPrompts = (c: any, t: TFn) => {
    if (!c?.scoreResult?.wleis?.rawScores) return [];
    const { SEA = 0, OEA = 0, UOE = 0, ROE = 0 } = c.scoreResult.wleis.rawScores;
    let prompts = [];
    if (SEA < 20) prompts.push(t('candidate_detail.prompt.sea', 'Can you describe a time you felt overwhelmed and how you recognized it?'));
    if (OEA < 20) prompts.push(t('candidate_detail.prompt.oea', 'Tell me about a situation where you had to read the room and adjust your approach.'));
    if (UOE < 20) prompts.push(t('candidate_detail.prompt.uoe', 'Describe a time when you motivated yourself to complete a tedious task.'));
    if (ROE < 20) prompts.push(t('candidate_detail.prompt.roe', 'How do you handle working with someone who is extremely stressed or frustrated?'));
    if (c.scoreResult?.icar?.percentile < 30) prompts.push(t('candidate_detail.prompt.icar', 'Can you walk me through your step-by-step process for solving a completely new problem?'));
    if (prompts.length === 0) {
      prompts.push(t('candidate_detail.prompt.balanced', 'Your scores indicate balanced emotional intelligence and cognitive skills. How do you plan to leverage these strengths in this role?'));
    }
    return prompts.slice(0, 3);
  };

  if (loading) return <div className="p-8 text-center">{t("candidate.loading", "Loading candidate...")}</div>;
  if (!selectedCandidate) return <div className="p-8 text-center">{t("candidate.not_found", "Candidate not found.")}</div>;

  const icar = selectedCandidate.scoreResult?.icar;
  const wleis = selectedCandidate.scoreResult?.wleis?.rawScores;
  const blurs = selectedCandidate.integrityEvents?.length || 0;
  const dur = selectedCandidate.duration;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
        <nav className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 sticky top-0 z-40 px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-1" /> {t('common.back', 'Back')}</Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>{t("candidate_detail.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
          <ThemeToggle />
        </nav>

        <div className="p-8 max-w-4xl mx-auto space-y-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">{selectedCandidate.name}</h1>
            <p className="text-slate-500">{selectedCandidate.roleTitle || selectedCandidate.appliedRole} • {selectedCandidate.status}</p>
          </div>

          {/* Fit badge + plain sentence */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-4 items-center">
              <Badge className="text-lg py-1 px-3" variant="secondary">{selectedCandidate.fitBadge || selectedCandidate.fit}</Badge>
              {blurs > 0 && (
                <Badge variant="destructive" className="text-lg py-1 px-3">{t('candidate_detail.integrity_flags', '⚠️ {count} Integrity Flags').replace('{count}', String(blurs))}</Badge>
              )}
              <div className="ml-auto flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={selectedCandidate.status === 'Shortlisted' ? 'default' : 'outline'} onClick={() => updateStatus('Shortlisted')}>{t("candidate_detail.shortlist", "Shortlist")}</Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("candidate_detail.shortlist_desc", "Move to Shortlisted status")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={selectedCandidate.status === 'Interviewing' ? 'default' : 'outline'} onClick={() => updateStatus('Interviewing')}>{t("candidate_detail.interview", "Interview")}</Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("candidate_detail.interview_desc", "Move to Interviewing status")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={selectedCandidate.status === 'Rejected' ? 'default' : 'outline'} onClick={() => updateStatus('Rejected')}>{t("candidate_detail.reject", "Reject")}</Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("candidate_detail.reject_desc", "Move to Rejected status")}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            {(selectedCandidate.fitBadge || selectedCandidate.fit) && (
              <p className="text-sm text-slate-500 mt-1">{fitBadgeSentence(selectedCandidate.fitBadge || selectedCandidate.fit, t)}</p>
            )}
          </div>

          {/* ICAR percentile + WLEIS total score cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-slate-500">{t("candidate_detail.cognitive", "Cognitive (ICAR)")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{icar?.percentile ?? 0}{t('candidate_detail.percentile_ordinal', 'th')} <span className="text-sm font-normal text-slate-500">{t('candidate_detail.percentile_unit', '%ile')}</span></p>
                {icar?.percentile !== undefined && (
                  <>
                    <p className="text-sm font-semibold mt-1">{icarPercentileLabel(icar.percentile, t)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{icarPercentileSentence(icar.percentile, t)}</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-slate-500">{t("candidate_detail.emotional_intelligence", "Emotional Intelligence")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{wleis?.Total ?? 0} <span className="text-sm font-normal text-slate-500">{t("candidate_detail.score", "Score")}</span></p>
                {wleis?.Total !== undefined && (
                  <>
                    <p className="text-sm font-semibold mt-1">{wleisLabel(wleis.Total, t)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{wleisSentence(wleis.Total, t)}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Domain breakdowns */}
          {selectedCandidate.scoreResult && (
            <div className="grid grid-cols-2 gap-4">
              {/* ICAR Domain Breakdown — 3 domains, no Spatial */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{t("candidate_detail.icar_breakdown", "ICAR Domain Breakdown")}</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  {(['numerical', 'verbal', 'abstract'] as const).map(domain => {
                    const val = icar?.domainScores?.[domain] ?? t('candidate_detail.not_available', 'N/A');
                    const numVal = typeof val === 'number' ? val : -1;
                    return (
                      <div key={domain} className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                        <div className="font-bold">{val}</div>
                        <div className="text-slate-500 text-[10px] uppercase">
                          {domain === 'numerical' ? t('candidate_detail.icar.numerical', 'Numerical') : 
                           domain === 'verbal' ? t('candidate_detail.icar.verbal', 'Verbal') : 
                           t('candidate_detail.icar.abstract', 'Abstract')}
                        </div>
                        {numVal >= 0 && (
                          <div className={`text-[10px] font-semibold mt-0.5 ${icarDomainColor(numVal)}`}>
                            {icarDomainLabel(numVal, t)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* WLEIS 4x4 Breakdown with subscale meanings + Low/Moderate/High */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{t("candidate_detail.wleis_breakdown", "WLEIS 4×4 Breakdown")}</h3>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {([
                    { key: 'SEA', label: t('candidate_detail.wleis.self_label', 'Self'), meaning: t('candidate_detail.wleis.self_meaning', 'Reading your own emotions') },
                    { key: 'OEA', label: t('candidate_detail.wleis.others_label', 'Others'), meaning: t('candidate_detail.wleis.others_meaning', "Reading others' emotions") },
                    { key: 'UOE', label: t('candidate_detail.wleis.use_label', 'Use'), meaning: t('candidate_detail.wleis.use_meaning', 'Using emotions to guide thinking') },
                    { key: 'ROE', label: t('candidate_detail.wleis.reg_label', 'Reg'), meaning: t('candidate_detail.wleis.reg_meaning', 'Managing your own emotions') },
                  ] as const).map(({ key, label, meaning }) => {
                    const val: number = wleis?.[key] ?? 0;
                    return (
                      <div key={key} className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                        <div className="font-bold">{val}</div>
                        <div className="text-slate-500 text-[10px] uppercase">{label}</div>
                        <div className={`text-[10px] font-semibold mt-0.5 ${wleisSubscaleColor(val)}`}>
                          {wleisSubscaleLabel(val, t)}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{meaning}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Anti-Cheating Summary */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">{t("candidate_detail.anti_cheating", "Anti-Cheating Logs")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">
                    {dur ? t('candidate_detail.time_format', '{m}m {s}s').replace('{m}', String(Math.floor(dur / 60))).replace('{s}', String(dur % 60)) : t('candidate_detail.not_available', 'N/A')}
                  </p>
                  <p className="text-xs text-slate-500 uppercase mt-1">{t("candidate_detail.total_duration", "Total Duration")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${blurs > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{blurs}</p>
                  <p className="text-xs text-slate-500 uppercase mt-1">{t("candidate_detail.tab_switch", "Tab-Switch Blurs")}</p>
                  {blurs === 0 ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{t("candidate_detail.no_issues", "No integrity issues detected.")}</p>
                  ) : (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {blurs === 1 
                        ? t('candidate_detail.blur_warning_singular', 'Candidate left the test window {count} time — review results with caution.').replace('{count}', String(blurs))
                        : t('candidate_detail.blur_warning_plural', 'Candidate left the test window {count} times — review results with caution.').replace('{count}', String(blurs))}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">{t("candidate_detail.custom_prompts", "Custom Interview Prompts")}</h3>
            <Card className="bg-slate-50 dark:bg-slate-900/50">
              <CardContent className="p-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {getDynamicPrompts(selectedCandidate, t).map((p, i) => (
                  <p key={i}>{i + 1}. "{p}"</p>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4 pt-4 border-t mt-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="flex-1" onClick={() => window.print()}>{t("candidate_detail.export_pdf", "Export PDF")}</Button>
              </TooltipTrigger>
              <TooltipContent>{t("candidate_detail.export_pdf_desc", "Print or save this candidate report as PDF")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" className="flex-1" onClick={() => handleDelete(selectedCandidate.id)}>{t("candidate_detail.delete_data", "Delete Data (GDPR)")}</Button>
              </TooltipTrigger>
              <TooltipContent>{t("candidate_detail.delete_data_desc", "Permanently delete all candidate data (GDPR hard delete)")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </main>
    </div>
  );
};
