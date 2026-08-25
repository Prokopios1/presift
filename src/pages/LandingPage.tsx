import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRegistered = !!user;
  const pricingLink = isRegistered ? '/pricing' : '/register?next=/pricing';

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 text-slate-900 dark:text-slate-50 selection:bg-blue-200">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
        {/* Navigation */}
        <nav className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-4 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
              <div className="hidden md:block font-bold text-2xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                PreSift
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" onClick={() => (window.location.href = '/dashboard')}>
                    Dashboard
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open recruiter dashboard</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" onClick={() => (window.location.href = '/register')}>
                    Register
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Register recruiter account</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" onClick={() => (window.location.href = '/admin')}>
                    Admin
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open admin portal</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={pricingLink}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 px-4 py-2 rounded-md"
                  >
                    Pricing
                  </Link>
                </TooltipTrigger>
                <TooltipContent>View pricing and credit packages</TooltipContent>
              </Tooltip>
              <ThemeToggle />
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/register"
                    className="h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-md flex items-center justify-center"
                  >
                    Start Now
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Register as a recruiter and start screening</TooltipContent>
              </Tooltip>
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
