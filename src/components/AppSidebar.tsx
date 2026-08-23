import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const AppSidebar = () => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const uid = localStorage.getItem('presift_uid');
        if (uid) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            setRole(userDoc.data()?.role || 'recruiter');
            return;
          }
        }
        
        const demoSession = localStorage.getItem('presift_demo_session');
        if (demoSession) {
          const parsed = JSON.parse(demoSession);
          setRole(parsed.role || 'recruiter');
        }
      } catch (err) {
        console.error('Role check failed:', err);
      }
    };
    checkRole();
  }, []);

  const navItems = [
    { label: 'Recruiter Dashboard', href: '/dashboard', tooltip: 'View and manage candidate assessments', show: true },
    { label: 'Owner / Admin', href: '/admin', tooltip: 'Global overview of all client accounts', show: role === 'admin' || role === 'owner' },
    { label: 'Buy Credits', href: '/pricing', tooltip: 'Purchase candidate assessment credits', show: true },
    { label: 'Home / Landing', href: '/', tooltip: 'Return to the PreSift homepage', show: true },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-60 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 z-40 hidden md:flex flex-col">
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
    </aside>
  );
};
