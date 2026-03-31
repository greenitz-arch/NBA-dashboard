'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import SideNav from '@/components/SideNav';
import DashboardClient from '@/components/DashboardClient';

export default function Home() {
  const [navOpen, setNavOpen] = useState(false);

  // [ key shortcut to open nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey) {
        setNavOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <main className="min-h-screen court-lines">
      <Header onOpenNav={() => setNavOpen(true)} />
      <SideNav open={navOpen} onClose={() => setNavOpen(false)} />
      <DashboardClient />
    </main>
  );
}
