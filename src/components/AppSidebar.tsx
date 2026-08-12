import { Button } from '@/components/ui/button';

export const AppSidebar = () => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const navItems = [
    { label: 'Recruiter Dashboard', href: '/dashboard' },
    { label: 'Owner / Admin', href: '/admin' },
    { label: 'Buy Credits', href: '/pricing' },
    { label: 'Home / Landing', href: '/' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-60 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 z-40 hidden md:flex flex-col">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="font-bold text-2xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          PreSift
        </div>
      </div>
      <nav className="flex flex-col gap-2 p-4 flex-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Button
              key={item.href}
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
          );
        })}
      </nav>
    </aside>
  );
};
