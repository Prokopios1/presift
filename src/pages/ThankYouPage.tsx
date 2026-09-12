import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useI18n } from '@/contexts/I18nContext';

export const ThankYouPage = () => {
  const { t, setLanguage } = useI18n();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get('lang');

  useEffect(() => {
    // Render in the candidate's assessment language: ?lang= drives it when
    // present; otherwise keep the stored UI language (Greek default).
    if (lang === 'el' || lang === 'en') {
      setLanguage(lang === 'el' ? 'gr' : 'en');
    }
  }, [lang, setLanguage]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 text-slate-900 dark:text-slate-50 selection:bg-blue-200">
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full shadow-lg border-t-4 border-t-emerald-600">
          <CardHeader className="text-center border-b pb-6">
            <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-mono mb-2 mx-auto">
              {t('test_page.complete_badge', 'Assessment Complete')}
            </div>
            <CardTitle className="text-3xl font-bold">{t('test_page.thank_you', 'Thank you for completing the assessment.')}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t('test_page.thank_body', 'Your responses have been submitted successfully and will be reviewed by the recruiter. You may now close this window.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-center">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('thankyou.next', 'Your responses have been submitted. The recruiter will review your results and contact you if your profile matches the role.')}
            </p>
            <p className="text-sm text-slate-400">
              {t('thankyou.close_hint', 'You may now close this window.')}
            </p>
            <Link to="/" className="inline-block text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 underline">
              {t('thankyou.back_home', 'Back to home')}
            </Link>
          </CardContent>
        </Card>
      </main>
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-8 text-center text-sm text-slate-400">
        <p>{t('landing.footer', `© ${new Date().getFullYear()} PreSift. All rights reserved. GDPR Compliant.`)}</p>
      </footer>
    </div>
  );
};
