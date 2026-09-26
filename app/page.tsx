'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import SideNav from '@/components/SideNav';
import DashboardClient from '@/components/DashboardClient';
import SkinBackdrop from '@/components/SkinBackdrop';
import { useTeams } from '@/lib/useTeams';

export default function Home() {
  const [navOpen, setNavOpen] = useState(false);
  const teamsApi = useTeams();

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
    <main className="min-h-screen court-lines skin-active">
      <SkinBackdrop />
      <Header onOpenNav={() => setNavOpen(true)} />
      <SideNav open={navOpen} onClose={() => setNavOpen(false)} teamsApi={teamsApi} />
      <DashboardClient teamsApi={teamsApi} />
    </main>
  );
}
