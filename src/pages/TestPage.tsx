import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
interface SessionItem {
  itemId: string;
  domain: string;
  prompt: string;
  options: string[];
}

export const TestPage = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionData, setSessionData] = useState<{ sessionId: string, items: SessionItem[], wleisItems: SessionItem[] } | null>(null);
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
  const [icarAnswers, setIcarAnswers] = useState<{ itemId: string, selectedIndex: number | null }[]>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_icar`);
    return saved ? JSON.parse(saved) : [];
  });
  const [wleisAnswers, setWleisAnswers] = useState<{ itemId: string, value: number | null }[]>(() => {
    const saved = localStorage.getItem(`assessment_${assessmentId}_wleis`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(`assessment_${assessmentId}_icar`, JSON.stringify(icarAnswers));
    localStorage.setItem(`assessment_${assessmentId}_wleis`, JSON.stringify(wleisAnswers));
    localStorage.setItem(`assessment_${assessmentId}_current`, JSON.stringify(currentQuestion));
    localStorage.setItem(`assessment_${assessmentId}_started`, JSON.stringify(started));
  }, [icarAnswers, wleisAnswers, currentQuestion, started, assessmentId]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        let currentSession = null;
        const savedSession = localStorage.getItem(`assessment_${assessmentId}_sessionData`);
        if (savedSession) {
           currentSession = JSON.parse(savedSession);
           setSessionData(currentSession);
        } else {
           const startSession = httpsCallable(functions, 'startSession');
           const response = await startSession({ assessmentId });
           currentSession = response.data as any;
           setSessionData(currentSession);
           localStorage.setItem(`assessment_${assessmentId}_sessionData`, JSON.stringify(currentSession));
        }

        // Try reading answers from Firestore first
        if (currentSession && currentSession.sessionId) {
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
                 setLoadingSession(false);
                 return;
               }
             }
           } catch (e) {
             console.error("Failed reading from Firestore, fallback to local storage", e);
           }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load session.");
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
      console.warn("INTEGRITY FLAG: User switched tabs!");
      if (sessionData?.sessionId) {
        // Send a beacon or async call
        fetch('/api/integrity', {
           method: 'POST', 
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ sessionId: sessionData.sessionId, type: 'blur', at: Date.now() })
        }).catch(() => {});
      }
    };


    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      window.removeEventListener("blur", handleBlur);
    };
  }, [started, sessionData?.sessionId]);

  useEffect(() => {
    if (!started || isSubmitting.current) return;
    if (timeLeft <= 0) {
      handleNextQuestion(null); // force skip
      return;
    }


    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, timeLeft, extraTime]);

  const submitTest = async (finalIcar: any, finalWleis: any) => {
    if (!sessionData || isSubmitting.current) return;
    isSubmitting.current = true;
    try {
      const submitAssessment = httpsCallable(functions, 'submitAssessment');
      await submitAssessment({
        sessionId: sessionData.sessionId,
        icar: finalIcar,
        wleis: finalWleis
      });
      alert("Assessment Complete!");
      localStorage.removeItem(`assessment_${assessmentId}_icar`);
      localStorage.removeItem(`assessment_${assessmentId}_wleis`);
      localStorage.removeItem(`assessment_${assessmentId}_current`);
      localStorage.removeItem(`assessment_${assessmentId}_sessionData`);
      localStorage.removeItem(`assessment_${assessmentId}_started`);
      navigate('/');
    } catch (err: any) {
      isSubmitting.current = false;
      if (err?.code === 'not-found' || err?.code === 'functions/not-found') {
        alert("This test session has expired \u2014 please start a new assessment.");
        localStorage.removeItem(`assessment_${assessmentId}_icar`);
        localStorage.removeItem(`assessment_${assessmentId}_wleis`);
        localStorage.removeItem(`assessment_${assessmentId}_current`);
        localStorage.removeItem(`assessment_${assessmentId}_sessionData`);
        localStorage.removeItem(`assessment_${assessmentId}_started`);
      } else {
        alert("Error submitting assessment.");
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
      submitTest(newIcar, newWleis);
    } else {
      setCurrentQuestion((prev: number) => prev + 1);
      setTimeLeft(extraTime ? Math.floor(45 * 1.5) : 45);
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
    const totalQuestions = sessionData.items.length + sessionData.wleisItems.length;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <Card className="max-w-2xl w-full shadow-lg border-t-4 border-t-slate-800">
          <CardHeader>
            <CardTitle className="text-3xl">Psychometric Assessment</CardTitle>
            <CardDescription>Session ID: {sessionData.sessionId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-lg text-sm text-slate-700 dark:text-slate-300 space-y-4">
              <div className="flex justify-between items-center border-b pb-4 border-slate-200 dark:border-slate-800">
                <span className="font-semibold">Estimated Duration</span>
                <span className="bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full font-mono">{(totalQuestions * 45) / 60} Minutes / {totalQuestions} Questions</span>
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
                  I agree to the processing of my responses.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 text-lg" disabled={!consent} onClick={startTest}>
              Begin Assessment
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Active Test Interface
  const maxTime = extraTime ? Math.floor(45 * 1.5) : 45;
  const progressPercent = (timeLeft / maxTime) * 100;

  const totalQuestions = sessionData.items.length + sessionData.wleisItems.length;
  const isIcar = currentQuestion < sessionData.items.length;
  const activeItem = isIcar 
    ? sessionData.items[currentQuestion]
    : sessionData.wleisItems[currentQuestion - sessionData.items.length];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col select-none">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
        <div className="font-mono text-sm text-slate-400">Question {currentQuestion + 1} of {totalQuestions}</div>
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
