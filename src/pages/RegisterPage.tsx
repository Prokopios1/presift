import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Building2, User, Mail, Briefcase, Lock } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    jobTitle: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Update profile name
      await updateProfile(user, { displayName: formData.name });

      // 3. Register with backend to create user doc and seed demo data
      const registerCallable = httpsCallable(functions, 'registerRecruiter');
      await registerCallable({
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        companyName: formData.companyName,
        jobTitle: formData.jobTitle
      });

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || t('register.error.default', 'Failed to create account.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <header className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </header>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">{t('register.title', 'Create an account')}</CardTitle>
          <CardDescription>
            {t('register.description', 'Enter your details below to get started with PreSift.')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div role="alert" className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="name">{t('register.name', 'Full Name')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  placeholder={t('register.name_placeholder', 'John Doe')}
                  required
                  className="pl-9"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('register.email', 'Work Email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  className="pl-9"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('register.password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  className="pl-9"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">{t('register.company', 'Company Name')}</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="companyName"
                  placeholder={t('register.company_placeholder', 'Acme Corp')}
                  required
                  className="pl-9"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitle">{t('register.job', 'Job Title')}</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="jobTitle"
                  placeholder={t('register.job_placeholder', 'Head of Talent')}
                  className="pl-9"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('register.submitting', 'Creating account...') : t('register.submit', 'Create account')}
            </Button>
            <div className="text-sm text-center text-slate-500">
              {t('register.has_account', 'Already have an account?')} {' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                {t('register.login', 'Sign in')}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
