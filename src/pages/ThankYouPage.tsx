import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Download, Trash2, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { functions } from '@/lib/firebase';
import { useI18n } from '@/contexts/I18nContext';

export const ThankYouPage = () => {
  const { t, setLanguage } = useI18n();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get('lang');
  const candidateId = searchParams.get('c');

  const [busy, setBusy] = useState<'download' | 'delete' | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Render in the candidate's assessment language: ?lang= drives it when
    // present; otherwise keep the stored UI language (Greek default).
    if (lang === 'el' || lang === 'en') {
      setLanguage(lang === 'el' ? 'gr' : 'en');
    }
  }, [lang, setLanguage]);

  const handleDownload = async () => {
    if (!candidateId) return;
    setBusy('download');
    setError(null);
    try {
      const res = await httpsCallable(functions, 'getCandidateSelf')({ candidateId });
      const data = res.data as Record<string, unknown>;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidate_data_${candidateId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError(t('thankyou.action_error', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!candidateId) return;
    if (!window.confirm(t('thankyou.delete_confirm', 'Are you sure you want to permanently delete your data? This action cannot be undone.'))) {
      return;
    }
    setBusy('delete');
    setError(null);
    try {
      await httpsCallable(functions, 'deleteCandidateSelf')({ candidateId });
      setDeleted(true);
    } catch {
      setError(t('thankyou.action_error', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

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

            {candidateId && (
              <div className="pt-2 space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button variant="outline" onClick={handleDownload} disabled={!!busy || deleted}>
                    {busy === 'download' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    {t('thankyou.download_data', 'Download my data')}
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={!!busy || deleted}>
                    {busy === 'delete' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    {t('thankyou.delete_data', 'Delete my data')}
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  {t('thankyou.data_rights_hint', 'You can download a copy of your data or ask us to erase it.')}
                </p>
                {deleted && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {t('thankyou.delete_success', 'Your data has been successfully deleted.')}
                  </p>
                )}
                {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
              </div>
            )}

            <p className="text-sm text-slate-400">
              {t('thankyou.close_hint', 'You may now close this window.')}
            </p>
          </CardContent>
        </Card>
      </main>
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-8 text-center text-sm text-slate-400">
        <p>{t('landing.footer', `© ${new Date().getFullYear()} PreSift. All rights reserved. GDPR Compliant.`)}</p>
      </footer>
    </div>
  );
};
