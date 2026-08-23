import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [errors, setErrors] = useState<{ name?: string; email?: string; companyName?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors: { name?: string; email?: string; companyName?: string } = {};

    if (!name.trim()) {
      nextErrors.name = 'Full name is required';
    }

    if (!email.trim()) {
      nextErrors.email = 'Business email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = 'Please enter a valid email address';
    }

    if (!companyName.trim()) {
      nextErrors.companyName = 'Company name is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const existingUid = localStorage.getItem('presift_uid');
      const uid = existingUid && existingUid.trim() ? existingUid.trim() : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `recruiter_${Date.now()}`);

      const registerCallable = httpsCallable(functions, 'registerRecruiter');
      const res = await registerCallable({
        uid,
        name: name.trim(),
        email: email.trim(),
        companyName: companyName.trim(),
      }) as any;

      const resData = res.data || {};
      const savedUid = resData.uid || uid;

      localStorage.setItem('presift_uid', savedUid);
      localStorage.setItem(
        'presift_demo_session',
        JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          companyName: companyName.trim(),
          role: 'recruiter',
          credits: resData.profile?.credits ?? 0,
        })
      );

      const ALLOWED_NEXT = new Set(['/pricing', '/dashboard']);
      const rawNext = searchParams.get('next');
      const next = rawNext && ALLOWED_NEXT.has(rawNext) ? rawNext : '/dashboard';
      navigate(next);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setServerError(err.message || 'Registration failed. Please verify your details and try again.');
    } finally {
      setLoading(false);
    }
  };

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
              <Link to="/" className="hidden md:block font-bold text-2xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                PreSift
              </Link>
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
                  <Button variant="ghost" onClick={() => (window.location.href = '/admin')}>
                    Admin
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open admin portal</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/pricing"
                    className="text-sm px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

        {/* Registration Section */}
        <section className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <div className="max-w-lg mx-auto">
            <Card className="shadow-xl border-slate-200/60 dark:border-slate-800">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  <h2>Recruiter Registration</h2>
                </CardTitle>
                <CardDescription>
                  Set up your recruiter profile to screen candidates and manage assessment credits.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit} noValidate>
                <CardContent className="space-y-4">
                  {serverError && (
                    <div
                      role="alert"
                      className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                    >
                      {serverError}
                    </div>
                  )}

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && (
                      <p className="text-xs text-red-500 font-medium">{errors.name}</p>
                    )}
                  </div>

                  {/* Business Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">
                      Business Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jane@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 font-medium">{errors.email}</p>
                    )}
                  </div>

                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName">
                      Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Acme Recruiting Inc."
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: undefined }));
                      }}
                      className={errors.companyName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      aria-invalid={!!errors.companyName}
                    />
                    {errors.companyName && (
                      <p className="text-xs text-red-500 font-medium">{errors.companyName}</p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20"
                  >
                    {loading ? 'Registering...' : 'Register as Recruiter'}
                  </Button>

                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 mt-2 space-y-1">
                    <p>
                      Already registered?{' '}
                      <Link to="/pricing" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        Buy Credits on Pricing
                      </Link>{' '}
                      or{' '}
                      <Link to="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        Go to Dashboard
                      </Link>
                    </p>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-8 text-center text-sm text-slate-400">
          <p>© {new Date().getFullYear()} PreSift. All rights reserved. GDPR Compliant.</p>
        </footer>
      </main>
    </div>
  );
};
