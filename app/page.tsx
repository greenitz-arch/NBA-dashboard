'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import SideNav from '@/components/SideNav';
import DashboardClient from '@/components/DashboardClient';
import SkinBackdrop from '@/components/SkinBackdrop';
import PlayerNewsPanel from '@/components/PlayerNewsPanel';
import ShareImportDialog from '@/components/ShareImportDialog';
import WhatsNewDialog from '@/components/WhatsNewDialog';
import { useTeams } from '@/lib/useTeams';
import { usePreferences } from '@/lib/usePreferences';
import { usePlayerNews } from '@/lib/usePlayerNews';

export default function Home() {
  const [navOpen, setNavOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const teamsApi = useTeams();
  const { prefs } = usePreferences();

  // "My roster" in Player news = every player on the person's own teams
  // (a head-to-head rival's team is not theirs, so it is left out).
  const rosterPlayers = useMemo(
    () =>
      teamsApi.teams
        .filter(t => !(prefs.fantasyMode && prefs.h2hMode && t.id === prefs.rivalTeamId))
        .flatMap(t => t.players),
    [teamsApi.teams, prefs.fantasyMode, prefs.h2hMode, prefs.rivalTeamId]
  );
  const news = usePlayerNews(rosterPlayers, teamsApi.hydrated);

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
      <DashboardClient teamsApi={teamsApi} newsCount={news.unseenMine} onOpenNews={() => setNewsOpen(true)} />
      <ShareImportDialog teamsApi={teamsApi} />
      <WhatsNewDialog hydrated={teamsApi.hydrated} hasTeams={teamsApi.teams.length > 0} />
      {newsOpen && <PlayerNewsPanel news={news} onClose={() => setNewsOpen(false)} />}
    </main>
  );
}
