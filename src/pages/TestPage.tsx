import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Label } from '@/components/ui/label';

import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

interface SessionItem {
  itemId: string;
  domain: string;
  prompt: string;
  options: string[];
}

interface SmileTrialConfig {
  trialId: string;
  start: number;
  end: number;
}

interface SmileTaskConfig {
  videoId: string;
  videoUrl: string;
  totalTrials: number;
  trials: SmileTrialConfig[];
}

interface SessionData {
  sessionId: string;
  items: SessionItem[];
  wleisItems: SessionItem[];
  lang?: 'el' | 'en';
  smileTask?: SmileTaskConfig;
}

type TestStage = 'landing' | 'icar_intro' | 'icar' | 'wleis_intro' | 'wleis' | 'smile_intro' | 'smile_trials' | 'smile_summary';

const wleisOptions = (t: (k: string, fb?: string) => string) => [
  t('test.wleis.opt.1', '1 Strongly disagree'),
  t('test.wleis.opt.2', '2 Disagree'),
  t('test.wleis.opt.3', '3 Neutral'),
  t('test.wleis.opt.4', '4 Agree'),
  t('test.wleis.opt.5', '5 Strongly agree'),
];

export const TestPage = () => {
  const { t, setLanguage } = useI18n();
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [started, setStarted] = useState(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_started`);
    return saved ? JSON.parse(saved) : false;
  });
  const [consent, setConsent] = useState(false);
  

  const [currentQuestion, setCurrentQuestion] = useState(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_current`);
    return saved ? JSON.parse(saved) : 0;
  });
  const [timeLeft, setTimeLeft] = useState(45);
  const isSubmitting = useRef(false);

  // Storage for answers
  const [icarAnswers, setIcarAnswers] = useState<{ itemId: string; selectedIndex: number | null }[]>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_icar`);
    return saved ? JSON.parse(saved) : [];
  });
  const [wleisAnswers, setWleisAnswers] = useState<{ itemId: string; value: number | null }[]>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_wleis`);
    return saved ? JSON.parse(saved) : [];
  });

  // Smile Perception state
  const [smileStage, setSmileStage] = useState<'instructions' | 'trials' | 'summary'>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_smileStage`);
    return saved ? JSON.parse(saved) : 'instructions';
  });
  const [smileTrialIndex, setSmileTrialIndex] = useState<number>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_smileTrialIndex`);
    return saved ? JSON.parse(saved) : 0;
  });
  const [smileAnswers, setSmileAnswers] = useState<{ trialId: string; perceived: 'genuine' | 'fake'; rtMs: number }[]>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_smile`);
    return saved ? JSON.parse(saved) : [];
  });
  const [submittedResult, setSubmittedResult] = useState<any>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_submittedResult`);
    return saved ? JSON.parse(saved) : null;
  });

  const [stage, setStage] = useState<TestStage>(() => {
    const savedStage = localStorage.getItem(`assessment_${assessmentId}_stage`);
    if (savedStage) return savedStage as TestStage;
    const savedStarted = localStorage.getItem(`assessment_${assessmentId}_started`);
    const isStarted = savedStarted ? JSON.parse(savedStarted) : false;
    if (!isStarted) return 'landing';
    const savedSmileStage = localStorage.getItem(`assessment_${assessmentId}_smileStage`);
    if (savedSmileStage === 'trials') return 'smile_trials';
    if (savedSmileStage === 'summary') return 'smile_summary';
    return 'icar';
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const trialStartTimeRef = useRef<number>(Date.now());

  const clearLocalStorage = () => {
    localStorage.removeItem(`assessment_${assessmentId}_icar`);
    localStorage.removeItem(`assessment_${assessmentId}_wleis`);
    localStorage.removeItem(`assessment_${assessmentId}_current`);
    localStorage.removeItem(`assessment_${assessmentId}_sessionData`);
    localStorage.removeItem(`assessment_${assessmentId}_started`);
    localStorage.removeItem(`assessment_${assessmentId}_stage`);
    localStorage.removeItem(`assessment_${assessmentId}_smile`);
    localStorage.removeItem(`assessment_${assessmentId}_smileStage`);
    localStorage.removeItem(`assessment_${assessmentId}_smileTrialIndex`);
    localStorage.removeItem(`assessment_${assessmentId}_submittedResult`);
  };

  useEffect(() => {
    localStorage.setItem(`assessment_${assessmentId}_icar`, JSON.stringify(icarAnswers));
    localStorage.setItem(`assessment_${assessmentId}_wleis`, JSON.stringify(wleisAnswers));
    localStorage.setItem(`assessment_${assessmentId}_current`, JSON.stringify(currentQuestion));
    localStorage.setItem(`assessment_${assessmentId}_started`, JSON.stringify(started));
    localStorage.setItem(`assessment_${assessmentId}_stage`, stage);
    localStorage.setItem(`assessment_${assessmentId}_smile`, JSON.stringify(smileAnswers));
    localStorage.setItem(`assessment_${assessmentId}_smileStage`, JSON.stringify(smileStage));
    localStorage.setItem(`assessment_${assessmentId}_smileTrialIndex`, JSON.stringify(smileTrialIndex));
  }, [icarAnswers, wleisAnswers, currentQuestion, started, stage, smileAnswers, smileStage, smileTrialIndex, assessmentId]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        let currentSession: SessionData | null = null;
        const savedSession = localStorage.getItem(`assessment_${assessmentId}_sessionData`);
        if (savedSession) {
          currentSession = JSON.parse(savedSession);
          setSessionData(currentSession);
        } else {
          const startSession = httpsCallable(functions, 'startSession');
          const response = await startSession({ assessmentId });
          currentSession = response.data as SessionData;
          setSessionData(currentSession);
          localStorage.setItem(`assessment_${assessmentId}_sessionData`, JSON.stringify(currentSession));
        }

        if (currentSession && currentSession.sessionId) {
          // Candidate link language drives all candidate-facing chrome. Guarded:
          // only switch when the server told us a lang (mocked startSession
          // responses in unit tests carry none and keep the test 'en' default).
          if (currentSession.lang === 'el' || currentSession.lang === 'en') {
            setLanguage(currentSession.lang === 'el' ? 'gr' : 'en');
          }
          try {
            const docSnap = await getDoc(doc(db, 'sessions', currentSession.sessionId));
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.answers && data.answers.length > 0) {
                const newIcar = data.answers.filter((a: any) => a.selectedIndex !== undefined);
                const newWleis = data.answers.filter((a: any) => a.value !== undefined);
                setIcarAnswers(newIcar);
                setWleisAnswers(newWleis);
                setCurrentQuestion(data.answers.length);
                setStarted(true);
                if (newIcar.length < currentSession.items.length) {
                  setStage('icar');
                } else if (newWleis.length < currentSession.wleisItems.length) {
                  setStage('wleis');
                } else if (currentSession.smileTask) {
                  setStage('smile_intro');
                }
                setLoadingSession(false);
                return;
              }
            }
          } catch {}
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load session.');
      } finally {
        setLoadingSession(false);
      }
    };
    fetchSession();
  }, [assessmentId]);

  // Anti-cheat measures
  useEffect(() => {
    if (!started) return;

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();

    const handleBlur = () => {
      console.warn('INTEGRITY FLAG: User switched tabs!');
      if (sessionData?.sessionId) {
        fetch('/api/integrity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionData.sessionId, type: 'blur', at: Date.now() }),
        }).catch(() => {});
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('blur', handleBlur);
    };
  }, [started, sessionData?.sessionId]);

  // Timer for ICAR and WLEIS
  useEffect(() => {
    if (!started || isSubmitting.current) return;
    if (stage !== 'icar' && stage !== 'wleis') return;
    const totalQuestions = (sessionData?.items?.length || 0) + (sessionData?.wleisItems?.length || 0);
    if (currentQuestion >= totalQuestions) return;

    if (timeLeft <= 0) {
      handleNextQuestion(null);
      return;
    }

    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, stage, timeLeft, currentQuestion, sessionData]);

  // Video trial control
  const currentSmileTrial = sessionData?.smileTask?.trials?.[smileTrialIndex];

  useEffect(() => {
    if ((stage !== 'smile_trials' && smileStage !== 'trials') || !currentSmileTrial || !videoRef.current) return;
    const video = videoRef.current;
    video.currentTime = currentSmileTrial.start;
    trialStartTimeRef.current = Date.now();

    video.play();
  }, [stage, smileStage, smileTrialIndex, currentSmileTrial]);

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !currentSmileTrial) return;
    if (videoRef.current.currentTime >= currentSmileTrial.end) {
      videoRef.current.pause();
    }
  };



  const submitTest = async (finalIcar: any, finalWleis: any, finalSmile?: any) => {
    if (!sessionData || isSubmitting.current) return;
    isSubmitting.current = true;
    try {
      const submitAssessment = httpsCallable(functions, 'submitAssessment');
      const response = await submitAssessment({
        sessionId: sessionData.sessionId,
        icar: finalIcar,
        wleis: finalWleis,
        ...(finalSmile ? { smileAnswers: finalSmile } : {}),
      });
      const resData = response.data as any;
      if (resData?.scoreResult) {
        setSubmittedResult(resData.scoreResult);
        localStorage.setItem(`assessment_${assessmentId}_submittedResult`, JSON.stringify(resData.scoreResult));
      }
      if (!sessionData.smileTask) {
        alert(t('testpage.alert.8', 'Assessment Complete!'));
        clearLocalStorage();
        navigate('/');
      }
    } catch (err: any) {
      isSubmitting.current = false;
      if (err?.code === 'not-found' || err?.code === 'functions/not-found' || err?.message?.includes('not found')) {
        alert(t('testpage.alert.9', 'This test session has expired or is invalid — please start a new assessment.'));
        clearLocalStorage();
        navigate('/');
      } else {
        alert(t('testpage.alert.10', 'Error submitting assessment.'));
      }
      console.error(err);
    }
  };

  const handleNextQuestion = (selectedIndex: number | null = null) => {
    if (!sessionData) return;

    let newIcar = [...icarAnswers];
    let newWleis = [...wleisAnswers];

    const isIcar = currentQuestion < sessionData.items.length;
    const activeItem = isIcar
      ? sessionData.items[currentQuestion]
      : sessionData.wleisItems[currentQuestion - sessionData.items.length];

    if (isIcar) {
      newIcar.push({ itemId: activeItem.itemId, selectedIndex });
      setIcarAnswers(newIcar);
    } else {
      newWleis.push({ itemId: activeItem.itemId, value: selectedIndex !== null ? selectedIndex + 1 : null });
      setWleisAnswers(newWleis);
    }

    // Sync to Firestore
    const allAnswers = [...newIcar, ...newWleis];
    updateDoc(doc(db, 'sessions', sessionData.sessionId), {
      answers: allAnswers,
      sessionToken: (sessionData as any).sessionToken
    }).catch(e => console.error("Firestore sync failed", e));

    const totalQuestions = sessionData.items.length + sessionData.wleisItems.length;

    if (isIcar && currentQuestion >= sessionData.items.length - 1) {
      if (sessionData.wleisItems && sessionData.wleisItems.length > 0) {
        setCurrentQuestion(sessionData.items.length);
        setStage('wleis_intro');
      } else if (sessionData.smileTask) {
        setCurrentQuestion(totalQuestions);
        setStage('smile_intro');
        setSmileStage('instructions');
      } else {
        submitTest(newIcar, newWleis);
      }
    } else if (!isIcar && currentQuestion >= totalQuestions - 1) {
      if (sessionData.smileTask) {
        setCurrentQuestion(totalQuestions);
        setStage('smile_intro');
        setSmileStage('instructions');
      } else {
        submitTest(newIcar, newWleis);
      }
    } else {
      setCurrentQuestion((prev: number) => prev + 1);
      setTimeLeft(45);
    }
  };

  const handleSmileChoice = async (choice: 'genuine' | 'fake') => {
    if (!currentSmileTrial || !sessionData?.smileTask) return;
    const rtMs = Math.max(100, Date.now() - trialStartTimeRef.current);
    const newAnswers = [...smileAnswers, { trialId: currentSmileTrial.trialId, perceived: choice, rtMs }];
    setSmileAnswers(newAnswers);

    const totalTrials = sessionData.smileTask.trials.length;
    if (smileTrialIndex >= totalTrials - 1) {
      setStage('smile_summary');
      setSmileStage('summary');
      await submitTest(icarAnswers, wleisAnswers, newAnswers);
    } else {
      setSmileTrialIndex((prev) => prev + 1);
    }
  };

  const startTest = () => {
    setStarted(true);
    if (sessionData && sessionData.items.length > 0) {
      setStage('icar_intro');
    } else if (sessionData && sessionData.wleisItems.length > 0) {
      setStage('wleis_intro');
    } else if (sessionData?.smileTask) {
      setStage('smile_intro');
      setSmileStage('instructions');
    } else {
      setStage('icar_intro');
    }
  };

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-slate-950">{t("test.loading", "Loading assessment session...")}</div>;
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 bg-slate-950">
        {t("test.load_error", "Error")}: {error}
      </div>
    );
  }

  // Pre-test landing screen
  if (!started || stage === 'landing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 relative">
        <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("test_page.back", "Back")}</Button>
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(1)}>{t("test_page.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </nav>
        <Card className="max-w-2xl w-full shadow-lg border-t-4 border-t-slate-800">
          <CardHeader>
            <CardTitle className="text-3xl">{t("test_page.psychometric", "Psychometric Assessment")}</CardTitle>
            <CardDescription>{t("test_page.session_id", "Session ID:")} {sessionData.sessionId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">


            <div className="flex items-start space-x-2">
              <Checkbox id="terms" checked={consent} onCheckedChange={(checked) => setConsent(checked as boolean)} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="terms">{t("test_page.gdpr_consent", "Mandatory GDPR Consent")}</Label>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {t("test_page.gdpr_consent_body", "I agree to the processing of my responses for psychological and perceptual assessment.")}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="w-full h-12 text-lg" disabled={!consent} onClick={startTest}>
                  {t("test.btn.begin", "Begin Assessment")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("test.btn.start", "Start timed assessment session")}</TooltipContent>
            </Tooltip>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Stage 1 Instructions: ICAR
  if (stage === 'icar_intro') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4 relative">
        <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("test_page.back", "Back")}</Button>
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(1)}>{t("test_page.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </nav>
        <Card className="max-w-2xl w-full bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-blue-400">{t("test_page.stage1_title", "Stage 1: Cognitive Reasoning (ICAR)")}</CardTitle>
            <CardDescription className="text-slate-400">
              {t("test_page.stage1_desc", "Measuring general cognitive ability and problem-solving skills.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-slate-300">
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 text-sm leading-relaxed space-y-3">
              <p>
                {t("test_page.stage1_instr", "11 short reasoning questions — numbers, words, shapes. Answer each one; you have 45 seconds per question. The timer is shown at the top of the screen. Expected time: ~10 minutes.")}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                  onClick={() => {
                    setStage('icar');
                    setTimeLeft(45);
                  }}
                >
                  {t("test.btn.go", "Go")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("test.btn.begin_icar", "Begin ICAR questions")}</TooltipContent>
            </Tooltip>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Stage 2 Instructions: WLEIS
  if (stage === 'wleis_intro') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4 relative">
        <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("test_page.back", "Back")}</Button>
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(1)}>{t("test_page.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </nav>
        <Card className="max-w-2xl w-full bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-400">{t("test_page.stage2_title", "Stage 2: Emotional Intelligence (WLEIS)")}</CardTitle>
            <CardDescription className="text-slate-400">
              {t("test_page.stage2_desc", "Assessing workplace emotional intelligence and self-awareness.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-slate-300">
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 text-sm leading-relaxed space-y-3">
              <p>
                {t("test_page.stage2_instr", "16 statements — choose how much you agree on a 1–5 scale (1 = strongly disagree, 5 = strongly agree). You have 45 seconds per statement. Expected time: ~8 minutes.")}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                  onClick={() => {
                    setStage('wleis');
                    setTimeLeft(45);
                  }}
                >
                  {t("test.btn.go", "Go")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("test.btn.begin_wleis", "Begin WLEIS statements")}</TooltipContent>
            </Tooltip>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const totalQuestions = sessionData.items.length + sessionData.wleisItems.length;

  // Active Stage 3: Smile Task UI
  if ((stage === 'smile_intro' || stage === 'smile_trials' || stage === 'smile_summary' || currentQuestion >= totalQuestions) && sessionData.smileTask) {
    const smileTask = sessionData.smileTask;
    const totalSmileTrials = smileTask.trials.length;

    if (stage === 'smile_intro' || smileStage === 'instructions') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4 relative">
          <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("test_page.back", "Back")}</Button>
              <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(1)}>{t("test_page.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </nav>
          <Card className="max-w-2xl w-full bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-emerald-400">{t("test_page.stage3_title", "Stage 3: Smile Perception Assessment")}</CardTitle>
              <CardDescription className="text-slate-400">
                {t("test_page.stage3_desc", "Evaluating social perceptiveness and non-verbal emotion appraisal.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-slate-300">
              <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 text-sm leading-relaxed space-y-3">
                <p>
                  {t("test_page.stage3_instr", "Watch short video clips and decide if each smile is genuine or fake. Expected time: ~2 minutes.")}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    onClick={() => {
                      setStage('smile_trials');
                      setSmileStage('trials');
                      setSmileTrialIndex(0);
                    }}
                  >
                    {t("test.btn.go", "Go")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("test.btn.begin_video", "Begin video perception trials")}</TooltipContent>
              </Tooltip>
            </CardFooter>
          </Card>
        </div>
      );
    }

    if ((stage === 'smile_trials' || smileStage === 'trials') && currentSmileTrial) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col select-none">
          <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("test_page.back", "Back")}</Button>
                <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(1)}>{t("test_page.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
              <div className="font-mono text-sm text-slate-400">
                {t("test_page.smile_trial_of", "Smile Perception: Trial {current} of {total}").replace("{current}", String(smileTrialIndex + 1)).replace("{total}", String(totalSmileTrials))}
              </div>
            </div>
            <Progress value={((smileTrialIndex + 1) / totalSmileTrials) * 100} className="w-1/3 h-2 bg-slate-800" />
          </header>

          <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 max-w-4xl mx-auto w-full">
            <div className="relative w-full max-w-2xl bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                src={smileTask.videoUrl}
                onTimeUpdate={handleVideoTimeUpdate}
                playsInline
                preload="auto"
                muted
                className="w-full h-full object-cover"
              />

            </div>

            <div className="w-full max-w-2xl flex flex-col items-center space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-medium text-slate-200">{t("test_page.smile_question", "Is this smile genuine or fake?")}</h3>
                <p className="text-xs text-slate-400 mt-1">{t("test.video.instruct", "Once the clip finishes playing, choose if the video shows a real or fake smile.")}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-16 text-xl border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-600 text-emerald-100 font-semibold"
                      onClick={() => handleSmileChoice('genuine')}
                    >
                      {t("test_page.genuine", "Genuine Smile")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("test.btn.authentic", "Judge smile as authentic emotion")}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-16 text-xl border-rose-500/50 bg-rose-950/40 hover:bg-rose-600 text-rose-100 font-semibold"
                      onClick={() => handleSmileChoice('fake')}
                    >
                      {t("test_page.fake", "Fake / Posed Smile")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("test.btn.posed", "Real or fake smile?")}</TooltipContent>
                </Tooltip>
              </div>


            </div>
          </main>
        </div>
      );
    }

    if (stage === 'smile_summary' || smileStage === 'summary') {
      const smileRes = submittedResult?.smile || submittedResult?.scoreResult?.smile;
      const calibration = smileRes?.calibration;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4 relative">
          <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("test_page.back", "Back")}</Button>
              <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(1)}>{t("test_page.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </nav>
          <Card className="max-w-2xl w-full bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
            <CardHeader className="text-center border-b border-slate-800 pb-6">
              <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-mono mb-2">
                {t("test_page.complete_badge", "Assessment Complete")}
              </div>
              <CardTitle className="text-3xl font-bold">{t("test_page.thank_you", "Thank you for completing the assessment.")}</CardTitle>
              <CardDescription className="text-slate-400 text-base mt-2">
                {t("test_page.thank_body", "Your responses have been submitted successfully and will be reviewed by the recruiter. You may now close this window.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {calibration ? (
                <>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-2">{t("test_page.cal_summary", "Perceptual Calibration Summary")}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 text-center">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        {t("test_page.perc_accuracy", "Perceptual Accuracy")}
                      </div>
                      <div className="text-3xl font-bold text-emerald-400 font-mono">
                        {smileRes.score} / {smileRes.total}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        ({t("test_page.percent_correct", "{pct}% Correct").replace("{pct}", (smileRes.accuracy * 100).toFixed(0))})
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 text-center">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        {t("test_page.alignment_level", "Alignment Level")}
                      </div>
                      <div className="text-3xl font-bold text-sky-400">
                        {calibration.level}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 capitalize">
                        {t("test_page.bias_direction", "{bias} bias").replace("{bias}", calibration.biasDirection)}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                      <span className="text-slate-400">{t("test_page.self_oea", "Self-Reported OEA Score:")}</span>
                      <span className="font-mono font-semibold text-slate-200">{calibration.rawOea.toFixed(2)} / 5.00</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">{t("test_page.calibrated_oea", "Calibrated OEA Score:")}</span>
                      <span className="font-mono font-bold text-emerald-400">{calibration.calibratedOeaScore.toFixed(2)} / 5.00</span>
                    </div>
                  </div>
                </>
              ) : submittedResult ? null : (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <div className="animate-pulse text-emerald-400 font-semibold">{t("test.submitting", "Submitting your responses...")}</div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    onClick={() => {
                      clearLocalStorage();
                      navigate('/');
                    }}
                  >
                    {t("test_page.go_dashboard", "Complete & Return Home")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("test.btn.submit", "Submit results and return home")}</TooltipContent>
              </Tooltip>
            </CardFooter>
          </Card>
        </div>
      );
    }
  }

  // Active Stage 1 & 2: ICAR & WLEIS Interface
  const maxTime = 45;
  const progressPercent = (timeLeft / maxTime) * 100;

  const isIcar = currentQuestion < sessionData.items.length;
  const activeItem = isIcar
    ? sessionData.items[currentQuestion]
    : sessionData.wleisItems[currentQuestion - sessionData.items.length];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col select-none">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> {t("test_page.back", "Back")}</Button>
            <Button variant="outline" size="sm" className="bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 hover:text-white disabled:text-slate-500" onClick={() => navigate(1)}>{t("test_page.forward", "Forward ")}<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
          <div className="font-mono text-sm text-slate-400">
            {t("test_page.question_of", "Question {current} of {total}").replace("{current}", String(currentQuestion + 1)).replace("{total}", String(totalQuestions))}
          </div>
        </div>
        <div className={`font-mono text-xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
          00:{timeLeft.toString().padStart(2, '0')}
        </div>
      </header>
      <Progress value={progressPercent} className="h-1 rounded-none bg-slate-800" />

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-3xl space-y-12">
          <div className="bg-white text-black p-12 rounded-xl shadow-2xl relative flex items-center justify-center text-center">
            <div className="font-serif text-2xl font-bold whitespace-pre-wrap">{activeItem.prompt}</div>
          </div>

          {isIcar ? (
            <div className="grid grid-cols-2 gap-4">
              {activeItem.options.map((opt, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="h-auto p-4 text-lg border-slate-700 bg-slate-800 hover:bg-slate-700 text-white whitespace-pre-wrap text-left justify-start"
                  onClick={() => handleNextQuestion(i)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {wleisOptions(t).map((opt, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="h-auto p-4 text-lg border-slate-700 bg-slate-800 hover:bg-slate-700 text-white whitespace-pre-wrap text-left justify-start"
                  onClick={() => handleNextQuestion(i)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
