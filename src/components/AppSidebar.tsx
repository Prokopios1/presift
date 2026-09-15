import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { LogOut, Menu, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export const AppSidebar = () => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const { role } = useAuth();
  const { t } = useI18n();
  const [signingOut, setSigningOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { label: t('nav.dashboard', 'Recruiter Dashboard'), href: '/dashboard', tooltip: t('nav.dashboard.tooltip', 'View and manage candidate assessments'), show: true },
    { label: t('nav.profile', 'Profile & Billing'), href: '/profile', tooltip: t('nav.profile.tooltip', 'Manage your profile and view billing history'), show: true },
    { label: t('nav.admin', 'Admin Dashboard'), href: '/admin', tooltip: t('nav.admin.tooltip', 'Global overview of all client accounts'), show: role === 'admin' },
    { label: t('nav.pricing', 'Buy Credits'), href: '/pricing', tooltip: t('nav.pricing.tooltip', 'Purchase candidate assessment credits'), show: true },
    { label: t('nav.home', 'Home / Landing'), href: '/', tooltip: t('nav.home.tooltip', 'Return to the PreSift homepage'), show: true },
  ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('nav.open_menu', 'Open navigation menu')}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        className={`md:hidden fixed bottom-4 left-4 z-50 h-9 w-9 ${drawerOpen ? 'hidden' : ''}`}
      >
        <Menu className="h-5 w-5" />
      </Button>
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-full w-60 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 z-40 flex flex-col transition-transform duration-200 md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('nav.close_menu', 'Close navigation menu')}
          onClick={() => setDrawerOpen(false)}
          className="md:hidden absolute right-2 top-2 h-9 w-9"
        >
          <X className="h-5 w-5" />
        </Button>
      <div className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="font-bold text-2xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          PreSift
        </div>
      </div>
      <nav className="flex flex-col gap-2 p-4 flex-1">
        {navItems.filter(item => item.show).map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={`w-full justify-start text-base h-12 ${
                    isActive ? 'font-bold bg-slate-200 dark:bg-slate-800' : ''
                  }`}
                  onClick={() => {
                    window.location.href = item.href;
                  }}
                >
                  {item.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
        <LanguageSwitcher className="w-full justify-center h-10" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start text-base h-12 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOut(auth);
                window.location.href = '/login';
              }}
            >
              {signingOut ? <Spinner size="sm" className="mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
              {t('nav.signout', 'Sign Out')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('nav.signout.tooltip', 'End your session and return to the login page')}</TooltipContent>
        </Tooltip>
      </div>
      </aside>
    </>
  );
};
