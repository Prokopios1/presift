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
              {t('landing.hero.title_start', 'Beyond the resume: ')}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {t('landing.hero.title_highlight', 'Precise metrics for cognitive power and human chemistry.')}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {t('landing.hero.subtitle', '10 minutes to measure IQ & EQ. Zero guesswork.')}
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
            </div>
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
