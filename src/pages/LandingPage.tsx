import { Link } from 'react-router-dom';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export const LandingPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const isRegistered = !!user;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 text-slate-900 dark:text-slate-50 selection:bg-blue-200">
      <main className="flex-1 w-full">
        <header className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
        </header>
        {/* Hero Section */}
        <main className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              {t('landing.hero.title_start', 'People aren\'t lying about themselves — they\'re just often wrong about themselves. ')}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {t('landing.hero.title_highlight', 'PreSift shows you the difference.')}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {t('landing.hero.subtitle', '10 minutes to measure IQ & EQ. Zero guesswork.')}
            </p>
            <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {t('landing.hero.body', 'Ask people to rate themselves and you get an opinion — usually a flattering one. PreSift pairs that self-rating with a real task that measures the same ability. When self-view and performance don\'t match, you learn something no single questionnaire can tell you.')}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={isRegistered ? '/dashboard' : '/register'}
                    className="h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-md flex items-center justify-center"
                  >
                    {t('landing.cta.start', 'Get Started')}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{t('landing.cta.tooltip', 'Start screening with pay-as-you-go credits')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={isRegistered ? '/dashboard?mode=benchmark' : '/register?intent=benchmark'}
                    className="h-14 px-8 text-lg border-2 border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-md flex items-center justify-center transition-colors"
                  >
                    {t('landing.cta.benchmark', 'Benchmark Your Team')}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{t('landing.cta.benchmark.tooltip', 'Test preSift on your current team members — risk-free')}</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 pt-1">
              {t('landing.cta.benchmark.subtext', 'Skeptical? Test preSift on your top performers first — 100% risk-free.')}
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-8 text-center text-sm text-slate-400">
          <p>{t('landing.footer', `© ${new Date().getFullYear()} PreSift. All rights reserved. GDPR Compliant.`)}</p>
        </footer>
      </main>
    </div>
  );
};
