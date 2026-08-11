import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';

export const AppNavMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}>
        <Menu className="w-6 h-6" />
      </Button>
      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm p-4">
            <DrawerHeader>
              <DrawerTitle>Navigation</DrawerTitle>
            </DrawerHeader>
            <div className="flex flex-col gap-2 mt-4">
              <Button variant="ghost" className="w-full justify-start text-lg h-12" onClick={() => { setMenuOpen(false); window.location.href = '/dashboard'; }}>Recruiter Dashboard</Button>
              <Button variant="ghost" className="w-full justify-start text-lg h-12" onClick={() => { setMenuOpen(false); window.location.href = '/admin'; }}>Owner / Admin</Button>
              <Button variant="ghost" className="w-full justify-start text-lg h-12" onClick={() => { setMenuOpen(false); window.location.href = '/pricing'; }}>Pricing / Buy Credits</Button>
              <Button variant="ghost" className="w-full justify-start text-lg h-12" onClick={() => { setMenuOpen(false); window.location.href = '/'; }}>Home / Landing</Button>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full mt-4">Close Menu</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
