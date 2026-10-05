import { AppSidebar } from '@/components/AppSidebar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useI18n } from '@/contexts/I18nContext';

export const RecruiterGuidePage = () => {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-50 selection:bg-blue-200 dark:selection:bg-blue-900 transition-colors duration-200">
      <AppSidebar />
      <main className="flex-1 md:ml-60 flex flex-col min-h-screen relative overflow-x-hidden">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('guide.title', 'Recruiter Guide')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Section 1 */}
          <section id="what-presift-is">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{t('guide.s1.title', 'What preSift is')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('guide.s1.body', 'preSift gives you two views of the same person, side by side: what the candidate says about themselves and how they perform on real tasks. It does not replace the interview — it supports it with measurable data, so you enter the conversation with evidence instead of guesses.')}</p>
              </CardContent>
            </Card>
          </section>

          {/* Section 2 */}
          <section id="three-modules">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{t('guide.s2.title', 'The three modules')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 list-disc list-inside text-slate-600 dark:text-slate-300">
                  <li>{t('guide.s2.m1', 'Logic & Reasoning — 11 short tasks (numerical, verbal, abstract). 45-second limit per question.')}</li>
                  <li>{t('guide.s2.m2', 'Emotional Intelligence — 16 self-report statements (WLEIS).')}</li>
                  <li>{t('guide.s2.m3', 'Emotion Perception — short videos; the candidate decides whether the smile is spontaneous or posed.')}</li>
                </ul>
                <p className="text-sm text-slate-500 dark:text-slate-400 italic pt-2 border-t border-slate-100 dark:border-slate-800">{t('guide.s2.note', 'The first two measure ability; the third measures perception, not truthfulness. All three are indicative, not diagnostic.')}</p>
              </CardContent>
            </Card>
          </section>

          {/* Section 3 */}
          <section id="how-it-works">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{t('guide.s3.title', 'How it works, step by step')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-2 list-decimal list-inside text-slate-600 dark:text-slate-300">
                  <li>{t('guide.s3.b1', 'You create an assessment link for a specific role (uses 1 credit).')}</li>
                  <li>{t('guide.s3.b2', 'You send the link to the candidate — no account needed.')}</li>
                  <li>{t('guide.s3.b3', 'The candidate consents (GDPR), reads the instructions and begins.')}</li>
                  <li>{t('guide.s3.b4', 'On completion, the report appears in your dashboard.')}</li>
                  <li>{t('guide.s3.b5', 'You export results to PDF/CSV and fold them into your process.')}</li>
                </ol>
              </CardContent>
            </Card>
          </section>

          {/* Section 4 */}
          <section id="rules-of-use">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{t('guide.s4.title', 'Rules of use')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 list-disc list-inside text-slate-600 dark:text-slate-300">
                  <li>{t('guide.s4.r1', 'The human decides. preSift is never the sole criterion for hiring or rejection.')}</li>
                  <li>{t('guide.s4.r2', 'Results show a tendency, not certainty. A low score does not mean "unsuitable".')}</li>
                  <li>{t('guide.s4.r3', 'The candidate never sees scores. They see only a thank-you page; the interpretation is for you.')}</li>
                  <li>{t('guide.s4.r4', 'Always interpret alongside CV, interview and references.')}</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* Section 5 */}
          <section id="legal-duties">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{t('guide.s5.title', 'Legal duties')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 list-disc list-inside text-slate-600 dark:text-slate-300">
                  <li>{t('guide.s5.l1', 'As the employer/client, you are the controller of the candidate data.')}</li>
                  <li>{t('guide.s5.l2', 'Use the data only for the current assessment process.')}</li>
                  <li>{t('guide.s5.l3', 'The candidate can download or delete their data at any time from the completion page.')}</li>
                  <li>{t('guide.s5.l4', 'Roles and obligations in full: the Data Processing Agreement (/dpa) and the Privacy Notice (/privacy).')}</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* Section 6 */}
          <section id="practicalities">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{t('guide.s6.title', 'Practicalities')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 list-disc list-inside text-slate-600 dark:text-slate-300">
                  <li>{t('guide.s6.p1', 'Credits: 1 credit per assessment link, charged when the link is created.')}</li>
                  <li>{t('guide.s6.p2', 'Integrity: copy and the right-click menu are blocked; focus/window deviations are recorded and may flag the attempt.')}</li>
                  <li>{t('guide.s6.p3', 'Export: PDF for one candidate, CSV for bulk analysis.')}</li>
                  <li>{t('guide.s6.p4', 'Archiving: candidates are archived, not deleted, so your history is preserved.')}</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* Section 7 */}
          <section id="faqs">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{t('guide.s7.title', 'Frequently asked questions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-900/50">
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{t('guide.s7.q1', 'Does the candidate see their score? No — only you do.')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-900/50">
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{t('guide.s7.q2', 'How long does it take? About 15–20 minutes in total.')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-900/50">
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{t('guide.s7.q3', 'Can they retake it? A new link means a new credit. There is no "reset".')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-900/50">
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{t('guide.s7.q4', 'What does "Strong/Moderate/Low fit" mean? It is an overall indicator based on percentile — not a verdict.')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-900/50">
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{t('guide.s7.q5', 'What is the "Integrity Flag"? An indication that something in the attempt was not clean; check it before judging.')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};
