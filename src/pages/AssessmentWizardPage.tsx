import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ArrowLeft, ArrowRight, Plus, Trash2, CheckCircle2, Loader2, Copy } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export const AssessmentWizardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { targetId } = useImpersonation();
  const recruiterId = targetId || user?.uid || '';
  
  const [step, setStep] = useState(1);
  const [balance, setBalance] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<{name: string, url: string}[]>([]);

  // Form State
  const [positionTitle, setPositionTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [modules, setModules] = useState<{ icar16: boolean; wleis16: boolean }>({ icar16: true, wleis16: false });
  const [candidates, setCandidates] = useState([{ name: '', email: '' }]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!recruiterId) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', recruiterId));
        if (userDoc.exists()) {
          setBalance(userDoc.data()?.credits || 0);
        }
      } catch (err) {
        console.error('Error fetching balance:', err);
      }
    };
    fetchBalance();
  }, [recruiterId]);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const canProceedStep1 = positionTitle.trim().length > 0;
  const canProceedStep2 = modules.icar16 || modules.wleis16;
  const canProceedStep3 = candidates.length > 0 && balance >= candidates.length;

  const handleAddCandidate = () => {
    setCandidates(prev => [...prev, { name: '', email: '' }]);
  };

  const handleRemoveCandidate = (index: number) => {
    setCandidates(prev => prev.filter((_, i) => i !== index));
  };

  const handleCandidateChange = (index: number, field: 'name' | 'email', value: string) => {
    setCandidates(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Create Campaign
      const createCampaign = httpsCallable(functions, 'createCampaign');
      const selectedModules = [];
      if (modules.icar16) selectedModules.push('icar16');
      if (modules.wleis16) selectedModules.push('wleis16');

      const campaignRes = await createCampaign({
        positionTitle: positionTitle.trim(),
        department: department.trim(),
        moduleIds: selectedModules,
        ...(recruiterId && { recruiterId })
      });
      const campaignId = (campaignRes.data as any).id;

      // 2. Create Assessment Links
      const createLink = httpsCallable(functions, 'createAssessmentLink');
      const links = [];
      
      for (const cand of candidates) {
        const res = await createLink({
          roleTitle: positionTitle.trim(),
          candidateName: cand.name.trim(),
          candidateEmail: cand.email.trim(),
          campaignId,
          ...(recruiterId && { recruiterId })
        });
        links.push({
          name: cand.name.trim() || 'Generic Candidate',
          url: (res.data as any).url
        });
      }

      setGeneratedLinks(links);
      setStep(4); // Success step
    } catch (e) {
      console.error(e);
      alert('Failed to create campaign or generate links. Please check the console.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
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
        
        <div className="p-8 max-w-4xl mx-auto space-y-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Create Assessment Campaign</h1>
            <p className="text-slate-500">Configure your assessment and invite candidates.</p>
          </div>

          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold ${
                  step > s ? 'bg-blue-600 border-blue-600 text-white' : 
                  step === s ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-slate-300 text-slate-400'
                }`}>
                  {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-4 rounded ${step > s ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                )}
              </div>
            ))}
          </div>

          <Card className="shadow-sm">
            {step === 1 && (
              <>
                <CardHeader>
                  <CardTitle>Step 1: Define Position</CardTitle>
                  <CardDescription>What role are you hiring for?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="positionTitle">Position Title <span className="text-red-500">*</span></Label>
                    <Input 
                      id="positionTitle" 
                      placeholder="e.g. Senior Backend Engineer" 
                      value={positionTitle}
                      onChange={(e) => setPositionTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department (Optional)</Label>
                    <Input 
                      id="department" 
                      placeholder="e.g. Engineering" 
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleNext} disabled={!canProceedStep1}>Next Step</Button>
                </CardFooter>
              </>
            )}

            {step === 2 && (
              <>
                <CardHeader>
                  <CardTitle>Step 2: Select Modules</CardTitle>
                  <CardDescription>Choose the assessment modules for this campaign.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div 
                      className={`flex items-start space-x-4 border p-4 rounded-lg cursor-pointer transition-colors ${modules.icar16 ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800'}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                          setModules(prev => ({ ...prev, icar16: !prev.icar16 }));
                        }
                      }}
                    >
                      <Checkbox id="mod-icar" checked={modules.icar16} onCheckedChange={(c) => setModules(prev => ({ ...prev, icar16: !!c }))} />
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="mod-icar" className="text-base cursor-pointer">ICAR-16 (Cognitive Ability)</Label>
                        <p className="text-sm text-slate-500">Measures fluid intelligence, spatial reasoning, and problem-solving skills.</p>
                      </div>
                    </div>
                    <div 
                      className={`flex items-start space-x-4 border p-4 rounded-lg cursor-pointer transition-colors ${modules.wleis16 ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800'}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                          setModules(prev => ({ ...prev, wleis16: !prev.wleis16 }));
                        }
                      }}
                    >
                      <Checkbox id="mod-wleis" checked={modules.wleis16} onCheckedChange={(c) => setModules(prev => ({ ...prev, wleis16: !!c }))} />
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="mod-wleis" className="text-base cursor-pointer">WLEIS-16 (Emotional Intelligence)</Label>
                        <p className="text-sm text-slate-500">Measures self-emotion appraisal, others' emotion appraisal, and use of emotion.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Pricing Preview</h4>
                      <p className="text-sm text-slate-500">1 credit per candidate, regardless of module count.</p>
                    </div>
                    <div className="font-bold text-lg">1 Credit / Candidate</div>
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  <Button variant="outline" onClick={handleBack}>Back</Button>
                  <Button onClick={handleNext} disabled={!canProceedStep2}>Next Step</Button>
                </CardFooter>
              </>
            )}

            {step === 3 && (
              <>
                <CardHeader>
                  <CardTitle>Step 3: Dispatch Candidates</CardTitle>
                  <CardDescription>Add candidates to generate their unique assessment links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {candidates.map((cand, idx) => (
                      <div key={idx} className="flex gap-4 items-start">
                        <div className="flex-1 space-y-2">
                          <Label>Candidate Name (Optional)</Label>
                          <Input 
                            placeholder="Name" 
                            value={cand.name} 
                            onChange={e => handleCandidateChange(idx, 'name', e.target.value)} 
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label>Candidate Email (Optional)</Label>
                          <Input 
                            placeholder="Email" 
                            type="email"
                            value={cand.email} 
                            onChange={e => handleCandidateChange(idx, 'email', e.target.value)} 
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="mt-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleRemoveCandidate(idx)}
                          disabled={candidates.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={handleAddCandidate} className="w-full border-dashed">
                      <Plus className="w-4 h-4 mr-2" /> Add Another Candidate
                    </Button>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-lg space-y-4">
                    <h4 className="font-semibold text-lg border-b pb-2">Campaign Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-slate-500">Position:</span> <span className="font-medium">{positionTitle}</span></div>
                      <div><span className="text-slate-500">Department:</span> <span className="font-medium">{department || '-'}</span></div>
                      <div><span className="text-slate-500">Modules:</span> <span className="font-medium">
                        {[modules.icar16 ? 'ICAR-16' : null, modules.wleis16 ? 'WLEIS-16' : null].filter(Boolean).join(', ')}
                      </span></div>
                      <div><span className="text-slate-500">Candidates:</span> <span className="font-medium">{candidates.length}</span></div>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="font-semibold">Total Cost: {candidates.length} Credits</div>
                        <div className="text-sm text-slate-500">Available Balance: {balance} Credits</div>
                      </div>
                      {balance < candidates.length && (
                        <div className="text-red-500 font-medium">Insufficient Credits</div>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  <Button variant="outline" onClick={handleBack} disabled={submitting}>Back</Button>
                  <Button onClick={handleSubmit} disabled={!canProceedStep3 || submitting}>
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : 'Create Campaign & Links'}
                  </Button>
                </CardFooter>
              </>
            )}

            {step === 4 && (
              <>
                <CardHeader>
                  <div className="flex items-center gap-3 text-green-600 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                    <CardTitle className="text-2xl">Campaign Created Successfully!</CardTitle>
                  </div>
                  <CardDescription>Your assessment links are ready to be sent to candidates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {generatedLinks.map((link, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-900 gap-4">
                        <span className="font-medium truncate flex-1">{link.name}</span>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Input value={link.url} readOnly className="w-full sm:w-64 bg-white dark:bg-slate-950" />
                          <Button variant="secondary" size="icon" onClick={() => copyToClipboard(link.url)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => navigate('/assessments')} className="w-full">
                    Go to Campaigns
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};
