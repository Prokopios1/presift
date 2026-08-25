import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { functions, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';

const UNIT_PRICE = 5; // €5.00 per credit

interface RegisteredProfile {
  name?: string;
  email?: string;
  companyName?: string;
  uid: string;
}

export const PaymentPage = () => {
  const { user } = useAuth();
  const { targetId } = useImpersonation();
  const recruiterId = targetId || user?.uid || '';

  const navigate = useNavigate();
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [credits, setCredits] = useState(5);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [vat, setVat] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [registeredProfile, setRegisteredProfile] = useState<RegisteredProfile | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const uid = recruiterId;
      if (!uid) return;

      try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() || {};
          if (data.companyName) setCompanyName(data.companyName);
          if (data.email) setEmail(data.email);
          if (data.vatId || data.vat) setVat(data.vatId || data.vat);
          if (data.billingAddress) setBillingAddress(data.billingAddress);

          setRegisteredProfile({
            uid,
            name: data.name || '',
            email: data.email || '',
            companyName: data.companyName || '',
          });
        }
      } catch (err) {
        console.error('Failed fetching user profile on PaymentPage:', err);
      }
    };

    loadProfile();
  }, [recruiterId]);

  const isPromo = credits === 1;
  const totalPrice = isPromo ? 1 : credits * UNIT_PRICE;

  const getDisplayName = () => {
    if (!registeredProfile) return '';
    const name = registeredProfile.name?.trim();
    const profileEmail = registeredProfile.email?.trim();
    const company = registeredProfile.companyName?.trim();

    if (name) {
      return profileEmail ? `${name} (${profileEmail})` : name;
    }
    if (company) {
      return profileEmail ? `${company} (${profileEmail})` : company;
    }
    if (profileEmail) {
      return profileEmail;
    }
    return `Recruiter (${registeredProfile.uid})`;
  };

  const handleCheckout = async () => {
    if (credits < 1) return;
    if (!recruiterId) {
      alert("Must be logged in to purchase credits.");
      return;
    }
    setPurchaseLoading(true);
    try {
      const createSession = httpsCallable(functions, 'createCheckoutSession');
      const res = await createSession({
        quantity: credits,
        uid: recruiterId,
        email: email || undefined,
        companyName: companyName || undefined,
        vatId: vat || undefined,
        billingAddress: billingAddress || undefined,
        origin: window.location.origin,
        isPromo,
      }) as any;
      window.location.href = res.data.url;
    } catch (e) {
      console.error('Failed to start checkout:', e);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  const adjustCredits = (delta: number) => {
    setCredits(prev => Math.max(1, Math.min(200, prev + delta)));
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 text-slate-900 dark:text-slate-50 selection:bg-blue-200">
      <AppSidebar />
      <main className="flex-1 w-full pl-0 md:pl-60">
        {/* Navigation */}
        <nav className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-3 sticky top-0 z-40 px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button variant="outline" size="sm" onClick={() => navigate(1)}>Forward <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
            <Link to="/" className="hidden md:block font-bold text-xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              PreSift
            </Link>
          </div>
          <div className="flex gap-3 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={() => (window.location.href = '/dashboard')}>Dashboard</Button>
              </TooltipTrigger>
              <TooltipContent>Open recruiter dashboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={() => (window.location.href = '/register')}>Register</Button>
              </TooltipTrigger>
              <TooltipContent>Register recruiter account</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={() => (window.location.href = '/admin')}>Admin</Button>
              </TooltipTrigger>
              <TooltipContent>Open admin portal</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/" className="text-sm underline">Back to Home</Link>
              </TooltipTrigger>
              <TooltipContent>Return to homepage</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </nav>

      {/* Pricing Section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple, transparent pricing</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">Pay only for what you use. No subscriptions, no hidden fees.</p>
        </div>
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
          {/* Price Card */}
          <Card className="w-full max-w-md shadow-2xl border-slate-200/60 dark:border-slate-800 mx-auto lg:mx-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Pay-As-You-Go Credits</CardTitle>
              <CardDescription>Non-expiring candidate assessment credits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Unit Price Badge */}
              <div className="flex items-center justify-center relative">
                {isPromo && (
                  <div className="absolute -top-3 px-3 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full uppercase tracking-widest shadow-sm animate-pulse">
                    Limited Time Offer
                  </div>
                )}
                <div className={`rounded-full px-6 py-3 text-center transition-colors ${isPromo ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'}`}>
                  {isPromo ? (
                    <span className="text-3xl font-bold">€1.00</span>
                  ) : (
                    <span className="text-3xl font-bold">€{UNIT_PRICE}</span>
                  )}
                  <span className="text-white/80 ml-1">/credit</span>
                </div>
              </div>

              {/* Numeric Stepper */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Number of Credits</Label>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(-5)} disabled={credits <= 1}>−5</Button>
                    </TooltipTrigger>
                    <TooltipContent>Decrease by 5 credits</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(-1)} disabled={credits <= 1}>−</Button>
                    </TooltipTrigger>
                    <TooltipContent>Decrease by 1 credit</TooltipContent>
                  </Tooltip>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={credits}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= 200) setCredits(val);
                    }}
                    className="text-center text-xl font-bold h-12 w-24"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(1)}>+</Button>
                    </TooltipTrigger>
                    <TooltipContent>Increase by 1 credit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(5)}>+5</Button>
                    </TooltipTrigger>
                    <TooltipContent>Increase by 5 credits</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Dynamic Total */}
              <div className={`rounded-lg p-4 flex justify-between items-center border transition-colors ${isPromo ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                <div className="flex flex-col">
                  <span className={`font-medium ${isPromo ? 'text-green-700 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>Total</span>
                  {isPromo && <span className="text-xs text-green-600 dark:text-green-500 font-medium mt-0.5">Trial discount applied!</span>}
                </div>
                <span className={`text-3xl font-bold tracking-tight ${isPromo ? 'text-green-600 dark:text-green-400' : ''}`}>€{totalPrice.toFixed(2)}</span>
              </div>

              {/* B2B Invoicing */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">B2B Invoicing Details</h4>
                  {registeredProfile ? (
                    <div
                      data-testid="signed-in-badge"
                      className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-md max-w-full overflow-hidden"
                    >
                      <span className="font-semibold shrink-0">Signed in as</span>
                      <span className="truncate max-w-[220px]" title={getDisplayName()}>
                        {getDisplayName()}
                      </span>
                    </div>
                  ) : (
                    <Link to="/register" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      Register account →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Company Name</Label>
                    <Input placeholder="Acme Corp" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" placeholder="billing@acme.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">VAT / Tax ID</Label>
                    <Input placeholder="DE123456789" value={vat} onChange={e => setVat(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Billing Address</Label>
                    <Input placeholder="Berlin, Germany" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className={`w-full h-12 text-base text-white shadow-md transition-colors ${isPromo ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`} onClick={handleCheckout} disabled={purchaseLoading}>
                    {purchaseLoading ? 'Redirecting to Stripe...' : `Checkout — €${totalPrice.toFixed(2)}`}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Proceed to secure Stripe checkout</TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span>💳 Credit Cards</span>
                <span>🏦 SEPA</span>
                <span>🍏 Apple Pay</span>
                <span>📱 Google Pay</span>
              </div>
            </CardFooter>
          </Card>

          {/* What's Included */}
          <div className="w-full max-w-sm space-y-6 mx-auto lg:mx-0 lg:pt-8">
            <h3 className="font-bold text-xl">Each credit includes:</h3>
            <ul className="space-y-4">
              {[
                "Full ICAR-16 cognitive assessment",
                "Full WLEIS-16 emotional intelligence screen",
                "Anti-cheating & integrity monitoring",
                "Percentile scores + fit badge",
                "Tailored behavioral interview prompts",
                "GDPR-compliant data controls",
                "Executive summary PDF export",
                "Auto-refund for abandoned sessions",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-green-500 mt-0.5 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
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
