import { useState } from 'react';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Link } from 'react-router-dom';
import { AppNavMenu } from '@/components/AppNavMenu';

const UNIT_PRICE = 5; // €5.00 per credit

export const PaymentPage = () => {
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [credits, setCredits] = useState(5);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [vat, setVat] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  const totalPrice = credits * UNIT_PRICE;

  const handleCheckout = async () => {
    if (credits < 1) return;
    setPurchaseLoading(true);
    try {
      const createSession = httpsCallable(functions, 'createCheckoutSession');
      const uid = localStorage.getItem('presift_uid') || 'demo_user';
      const res = await createSession({
        quantity: credits,
        uid,
        email: email || undefined,
        companyName: companyName || undefined,
        vatId: vat || undefined,
        billingAddress: billingAddress || undefined,
        origin: window.location.origin,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 text-slate-900 dark:text-slate-50 selection:bg-blue-200">
      {/* Navigation */}
      <nav className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <AppNavMenu />
            <div className="font-bold text-2xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              PreSift
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="ghost" onClick={() => (window.location.href = '/dashboard')}>Dashboard</Button>
            <Button variant="ghost" onClick={() => (window.location.href = '/admin')}>Admin</Button>
            <Link to="/" className="text-sm underline">Back to Home</Link>
          </div>
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
              <div className="flex items-center justify-center">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full px-6 py-3 text-center">
                  <span className="text-3xl font-bold">€{UNIT_PRICE}</span>
                  <span className="text-blue-100 ml-1">/credit</span>
                </div>
              </div>

              {/* Numeric Stepper */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Number of Credits</Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(-5)} disabled={credits <= 1}>−5</Button>
                  <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(-1)} disabled={credits <= 1}>−</Button>
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
                  <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(1)}>+</Button>
                  <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg font-bold" onClick={() => adjustCredits(5)}>+5</Button>
                </div>
              </div>

              {/* Dynamic Total */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 flex justify-between items-center border">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Total</span>
                <span className="text-3xl font-bold tracking-tight">€{totalPrice.toFixed(2)}</span>
              </div>

              {/* B2B Invoicing */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">B2B Invoicing Details</h4>
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
              <Button className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md" onClick={handleCheckout} disabled={purchaseLoading}>
                {purchaseLoading ? 'Redirecting to Stripe...' : `Checkout — €${totalPrice.toFixed(2)}`}
              </Button>
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
    </div>
  );
};
