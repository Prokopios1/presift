import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  smileTask?: SmileTaskConfig;
}

export const TestPage = () => {
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
  const [extraTime, setExtraTime] = useState(false);

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausedAtCut, setIsPausedAtCut] = useState(false);
  const trialStartTimeRef = useRef<number>(Date.now());

  const clearLocalStorage = () => {
    localStorage.removeItem(`assessment_${assessmentId}_icar`);
    localStorage.removeItem(`assessment_${assessmentId}_wleis`);
    localStorage.removeItem(`assessment_${assessmentId}_current`);
    localStorage.removeItem(`assessment_${assessmentId}_sessionData`);
    localStorage.removeItem(`assessment_${assessmentId}_started`);
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
    localStorage.setItem(`assessment_${assessmentId}_smile`, JSON.stringify(smileAnswers));
    localStorage.setItem(`assessment_${assessmentId}_smileStage`, JSON.stringify(smileStage));
    localStorage.setItem(`assessment_${assessmentId}_smileTrialIndex`, JSON.stringify(smileTrialIndex));
  }, [icarAnswers, wleisAnswers, currentQuestion, started, smileAnswers, smileStage, smileTrialIndex, assessmentId]);

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

        if (currentSession && currentSession.sessionId) { try { const docSnap = await getDoc(doc(db, 'sessions', currentSession.sessionId)); if (docSnap.exists()) { const data = docSnap.data(); if (data.answers && data.answers.length > 0) { const newIcar = data.answers.filter((a: any) => a.selectedIndex !== undefined); const newWleis = data.answers.filter((a: any) => a.value !== undefined); setIcarAnswers(newIcar); setWleisAnswers(newWleis); setCurrentQuestion(data.answers.length); setLoadingSession(false); return; } } } catch {} }
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
    const totalQuestions = (sessionData?.items?.length || 0) + (sessionData?.wleisItems?.length || 0);
    if (currentQuestion >= totalQuestions) return;

    if (timeLeft <= 0) {
      handleNextQuestion(null);
      return;
    }

    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, timeLeft, extraTime, currentQuestion, sessionData]);

  // Video trial control
  const currentSmileTrial = sessionData?.smileTask?.trials?.[smileTrialIndex];

  useEffect(() => {
    if (smileStage !== 'trials' || !currentSmileTrial || !videoRef.current) return;
    const video = videoRef.current;
    video.currentTime = currentSmileTrial.start;
    setIsPausedAtCut(false);
    trialStartTimeRef.current = Date.now();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [smileStage, smileTrialIndex, currentSmileTrial]);

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !currentSmileTrial) return;
    if (videoRef.current.currentTime >= currentSmileTrial.end) {
      videoRef.current.pause();
      setIsPlaying(false);
      setIsPausedAtCut(true);
    }
  };

  const replayTrial = () => {
    if (!videoRef.current || !currentSmileTrial) return;
    videoRef.current.currentTime = currentSmileTrial.start;
    setIsPausedAtCut(false);
    trialStartTimeRef.current = Date.now();
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
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
        alert('Assessment Complete!');
        clearLocalStorage();
        navigate('/');
      }
    } catch (err: any) {
      isSubmitting.current = false;
      if (err?.code === 'not-found' || err?.code === 'functions/not-found' || err?.message?.includes('not found')) {
        alert('This test session has expired or is invalid — please start a new assessment.');
        clearLocalStorage();
        navigate('/');
      } else {
        alert('Error submitting assessment.');
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

    if (currentQuestion >= totalQuestions - 1) {
      if (sessionData.smileTask) {
        // Move to Smile Task instructions
        setCurrentQuestion(totalQuestions);
        setSmileStage('instructions');
      } else {
        submitTest(newIcar, newWleis);
      }
    } else {
      setCurrentQuestion((prev: number) => prev + 1);
      setTimeLeft(extraTime ? Math.floor(45 * 1.5) : 45);
    }
  };

  const handleSmileChoice = async (choice: 'genuine' | 'fake') => {
    if (!currentSmileTrial || !sessionData?.smileTask) return;
    const rtMs = Math.max(100, Date.now() - trialStartTimeRef.current);
    const newAnswers = [...smileAnswers, { trialId: currentSmileTrial.trialId, perceived: choice, rtMs }];
    setSmileAnswers(newAnswers);

    const totalTrials = sessionData.smileTask.trials.length;
    if (smileTrialIndex >= totalTrials - 1) {
      setSmileStage('summary');
      await submitTest(icarAnswers, wleisAnswers, newAnswers);
    } else {
      setSmileTrialIndex((prev) => prev + 1);
    }
  };

  const startTest = () => {
    setStarted(true);
    setTimeLeft(extraTime ? Math.floor(45 * 1.5) : 45);
  };

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-slate-950">Loading assessment session...</div>;
  }

  if (error || !sessionData) {
    return <div className="min-h-screen flex items-center justify-center text-red-500 bg-slate-950">Error: {error}</div>;
  }

  if (!started) {
    const totalQuestions = sessionData.items.length + sessionData.wleisItems.length + (sessionData.smileTask ? sessionData.smileTask.trials.length : 0);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 relative">
        <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </nav>
        <Card className="max-w-2xl w-full shadow-lg border-t-4 border-t-slate-800">
          <CardHeader>
            <CardTitle className="text-3xl">Psychometric Assessment</CardTitle>
            <CardDescription>Session ID: {sessionData.sessionId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-lg text-sm text-slate-700 dark:text-slate-300 space-y-4">
              <div className="flex justify-between items-center border-b pb-4 border-slate-200 dark:border-slate-800">
                <span className="font-semibold">Assessment Structure</span>
                <span className="bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full font-mono text-xs">
                  ICAR Cognitive + WLEIS EI {sessionData.smileTask ? '+ Smile Perception' : ''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Items</span>
                <span className="bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full font-mono text-xs">{totalQuestions} Total Trials</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
              <Switch id="accessibility" checked={extraTime} onCheckedChange={setExtraTime} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="accessibility">Accessibility Mode: Extra Processing Time</Label>
                <p className="text-sm text-slate-500">Extends item timers by 50% if you require accommodations.</p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="terms" checked={consent} onCheckedChange={(checked) => setConsent(checked as boolean)} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="terms">Mandatory GDPR Consent</Label>
                <p className="text-sm text-slate-500 leading-relaxed">
                  I agree to the processing of my responses for psychological and perceptual assessment.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="w-full h-12 text-lg" disabled={!consent} onClick={startTest}>
                  Begin Assessment
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start timed assessment session</TooltipContent>
            </Tooltip>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const totalQuestions = sessionData.items.length + sessionData.wleisItems.length;

  // Active Stage 3: Smile Task UI
  if (currentQuestion >= totalQuestions && sessionData.smileTask) {
    const smileTask = sessionData.smileTask;
    const totalSmileTrials = smileTask.trials.length;

    if (smileStage === 'instructions') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4 relative">
          <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </nav>
          <Card className="max-w-2xl w-full bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-emerald-400">Stage 3: Smile Perception Assessment</CardTitle>
              <CardDescription className="text-slate-400">
                Evaluating social perceptiveness and non-verbal emotion appraisal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-slate-300">
              <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 text-sm leading-relaxed space-y-3">
                <p>
                  You will view <strong>{totalSmileTrials} short video clips</strong> of individuals expressing smiles.
                </p>
                <p>
                  For each clip, your task is to evaluate whether the smile is <strong>Genuine</strong> (authentic emotion) or <strong>Fake</strong> (posed or social smile). A genuine smile reaches the eyes (Duchenne criterion).
                </p>
                <p>
                  Each video clip plays automatically and pauses at the end of the trial. You may replay any clip before submitting your judgment.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    onClick={() => setSmileStage('trials')}
                  >
                    Start Smile Assessment ({totalSmileTrials} Trials)
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Begin video perception trials</TooltipContent>
              </Tooltip>
            </CardFooter>
          </Card>
        </div>
      );
    }

    if (smileStage === 'trials' && currentSmileTrial) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col select-none">
          <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
              <div className="font-mono text-sm text-slate-400">
                Smile Perception: Trial <span className="text-emerald-400 font-bold">{smileTrialIndex + 1}</span> of {totalSmileTrials}
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
              {!isPlaying && !isPausedAtCut && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={replayTrial}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 text-white hover:bg-black/40 transition-all"
                    >
                      <span className="px-6 py-3 bg-emerald-600 rounded-lg text-lg font-semibold shadow-lg">Play Video Clip</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Play video clip</TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="w-full max-w-2xl flex flex-col items-center space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-medium text-slate-200">Is this smile genuine or fake?</h3>
                <p className="text-xs text-slate-400 mt-1">Select your judgment below once the clip finishes playing.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-16 text-xl border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-600 text-emerald-100 font-semibold"
                      onClick={() => handleSmileChoice('genuine')}
                    >
                      Genuine Smile
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Judge smile as authentic emotion</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-16 text-xl border-rose-500/50 bg-rose-950/40 hover:bg-rose-600 text-rose-100 font-semibold"
                      onClick={() => handleSmileChoice('fake')}
                    >
                      Fake / Posed Smile
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Judge smile as posed or social</TooltipContent>
                </Tooltip>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-200 text-xs"
                    onClick={replayTrial}
                  >
                    ↺ Replay Video Clip
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Replay the current video clip from start</TooltipContent>
              </Tooltip>
            </div>
          </main>
        </div>
      );
    }

    if (smileStage === 'summary') {
      const smileRes = submittedResult?.smile || submittedResult?.scoreResult?.smile;
      const calibration = smileRes?.calibration;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4 relative">
          <nav className="absolute top-0 left-0 w-full p-4 flex items-center z-40 bg-transparent">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </nav>
          <Card className="max-w-2xl w-full bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
            <CardHeader className="text-center border-b border-slate-800 pb-6">
              <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-mono mb-2">
                Assessment Complete
              </div>
              <CardTitle className="text-3xl font-bold">WLEIS & Smile Calibration Summary</CardTitle>
              <CardDescription className="text-slate-400">
                Perceptual Emotional Accuracy aligned with Self-Reported Others' Emotion Appraisal
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {calibration ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 text-center">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Perceptual Accuracy
                      </div>
                      <div className="text-3xl font-bold text-emerald-400 font-mono">
                        {smileRes.score} / {smileRes.total}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        ({(smileRes.accuracy * 100).toFixed(0)}% Correct)
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 text-center">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Alignment Level
                      </div>
                      <div className="text-3xl font-bold text-sky-400">
                        {calibration.level}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 capitalize">
                        {calibration.biasDirection} bias
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Self-Reported OEA Score:</span>
                      <span className="font-mono font-semibold text-slate-200">{calibration.rawOea.toFixed(2)} / 5.00</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Calibrated OEA Score:</span>
                      <span className="font-mono font-bold text-emerald-400">{calibration.calibratedOeaScore.toFixed(2)} / 5.00</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 bg-slate-950 p-4 rounded-lg border border-slate-800 leading-relaxed">
                    <strong>Calibration Insight:</strong> Your self-reported emotional appraisal (OEA) has been objectively calibrated against your actual perceptual discrimination of subtle facial micro-expressions.
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <div className="animate-pulse text-emerald-400 font-semibold">Submitting and calculating score calibration...</div>
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
                    Complete & Return to Dashboard
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Submit results and return home</TooltipContent>
              </Tooltip>
            </CardFooter>
          </Card>
        </div>
      );
    }
  }

  // Active Stage 1 & 2: ICAR & WLEIS Interface
  const maxTime = extraTime ? Math.floor(45 * 1.5) : 45;
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
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
          <div className="font-mono text-sm text-slate-400">
            Question {currentQuestion + 1} of {totalQuestions}
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
        </div>
      </main>
    </div>
  );
};
