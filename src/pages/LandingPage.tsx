import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';

export const LandingPage = () => {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 text-slate-900 dark:text-slate-50 selection:bg-blue-200">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
        {/* Navigation */}
        <nav className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-4 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="font-bold text-2xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                PreSift
              </div>
            </div>
          <div className="flex gap-3 items-center">
            <Button variant="ghost" onClick={() => (window.location.href = '/dashboard')}>
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => (window.location.href = '/admin')}>
              Admin
            </Button>
            <Link
              to="/pricing"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 px-4 py-2 rounded-md"
            >
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
            Stop interviewing candidates who look good on paper but{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              fail under pressure.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Screen fluid intelligence &amp; stress resilience in 10 minutes. Reduce bad hires by filtering candidates objectively before the first interview.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
            <Link
              to="/pricing"
              className="h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-md flex items-center justify-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-8 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} PreSift. All rights reserved. GDPR Compliant.</p>
        </footer>
      </main>
    </div>
  );
};
