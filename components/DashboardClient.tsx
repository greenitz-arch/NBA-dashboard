'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MAX_ROSTER, type UseTeamsReturn } from '@/lib/useTeams';
import type { WatchlistPlayer } from '@/lib/storage';
import { usePreferences } from '@/lib/usePreferences';
import type { GameStats, Player } from '@/lib/nba';
import PlayerCard from './PlayerCard';
import PlayerSelector from './PlayerSelector';
import EmptyState from './EmptyState';
import Toast from './Toast';
import TeamSwitcher from './TeamSwitcher';
import ConfirmDialog from './ConfirmDialog';
import { TutorialProvider } from './TutorialGuide';
import FantasyToggle from './FantasyToggle';
import { RosterStatusStrip, TeamStrengths, HotColdList } from './FantasyPanels';
import ShareTeamModal from './ShareTeamModal';
import HeadToHead from './HeadToHead';
import { useFantasy } from '@/lib/useFantasy';
import { fetchCardStats } from '@/lib/clientStats';

const POLL_INTERVAL = 10 * 60 * 1000;

function shouldPoll(): boolean {
  const now = new Date();
  const etHour = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  ).getHours();
  return etHour >= 18 || etHour < 3;
}

function sortPlayers(
  players: WatchlistPlayer[],
  stats: Record<number, GameStats>,
  sortBy: string
): WatchlistPlayer[] {
  const copy = [...players];
  switch (sortBy) {
    case 'az':
      return copy.sort((a, b) => a.last_name.localeCompare(b.last_name));
    case 'by-team':
      return copy.sort((a, b) => a.team_full_name.localeCompare(b.team_full_name));
    case 'by-position': {
      const order = ['C', 'PF', 'SF', 'SG', 'PG'];
      return copy.sort((a, b) => {
        const ai = order.indexOf(a.position) === -1 ? 99 : order.indexOf(a.position);
        const bi = order.indexOf(b.position) === -1 ? 99 : order.indexOf(b.position);
        return ai - bi;
      });
    }
    case 'date-added':
      return copy.sort((a, b) => (a.added_at ?? 0) - (b.added_at ?? 0));
    case 'recent':
    default:
      return copy.sort((a, b) => {
        const aDate = stats[a.id]?.gameDate ?? '';
        const bDate = stats[b.id]?.gameDate ?? '';
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }
}

// Scroll indicator — pulsing chevron, disappears when at bottom of page
function ScrollArrow({
  gridRef,
  playerCount,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  playerCount: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (playerCount === 0) { setVisible(false); return; }

    const check = () => {
      const el = gridRef.current;
      if (!el) { setVisible(false); return; }

      // Use scrollHeight vs clientHeight to detect if page actually scrolls
      const pageScrollable = document.body.scrollHeight > window.innerHeight + 50;
      const atBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 60;

      setVisible(pageScrollable && !atBottom);
    };

    // Wait for layout to settle after players render
    const t1 = setTimeout(check, 100);
    const t2 = setTimeout(check, 600);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [gridRef, playerCount]);

  if (!visible) return null;

  return (
    <div className="flex justify-center my-4" aria-hidden="true">
      <div
        className="animate-pulse-soft"
        style={{
          color: 'var(--skin-primary)',
          filter: 'drop-shadow(0 0 8px rgba(var(--skin-primary-rgb),0.5))',
        }}
      >
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
  );
}

interface DashboardClientProps {
  teamsApi: UseTeamsReturn;
}

export default function DashboardClient({ teamsApi }: DashboardClientProps) {
  const { teams, activeTeam, watchlist, addPlayer, removePlayer, restorePlayer, createRivalTeam, isWatching, isFull, switchTeam, createTeam, renameTeam, deleteTeam, hydrated } = teamsApi;
  const { prefs, updatePref } = usePreferences();
  const [stats, setStats] = useState<Record<number, GameStats>>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorMode, setSelectorMode] = useState<'conference' | 'all-teams' | 'search'>('conference');
  const [showToast, setShowToast] = useState(false);
  const [showTeamFullSuggestion, setShowTeamFullSuggestion] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Which team the player picker is adding to: your own team, or the head-to-head rival.
  const [selectorTarget, setSelectorTarget] = useState<'mine' | 'rival'>('mine');
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const fantasyOn = prefs.fantasyMode;
  const fantasy = useFantasy(watchlist, fantasyOn && hydrated);
  const fantasyReady = Object.keys(fantasy.data).length > 0;

  // Head-to-head matchup: the rival is just another Courtside team.
  const rivalTeam = teams.find(t => t.id === prefs.rivalTeamId && t.id !== activeTeam?.id) ?? null;
  const otherTeams = teams.filter(t => t.id !== activeTeam?.id);
  const h2hOn = fantasyOn && prefs.h2hMode && !!activeTeam;

  // Lets the stats loader below look up each player without re-creating itself.
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  const fetchStats = useCallback(async (playerIds: number[], force = false) => {
    if (playerIds.length === 0) { setStats({}); return; }
    if (!force && !shouldPoll()) return;

    const cacheKey = `stats_${[...playerIds].sort().join(',')}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < POLL_INTERVAL) { setStats(data); return; }
        }
      } catch {}
    }

    setLoadingStats(true);
    try {
      // Stats now come from the visitor's browser (ESPN refuses the server).
      const byId = new Map(watchlistRef.current.map(p => [p.id, p]));
      const list = playerIds.map(id => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
      const parsed: Record<number, GameStats> = await fetchCardStats(list);
      const ts = Date.now();
      setStats(parsed);
      // Only remember a successful answer, so a failed try is retried next time.
      if (Object.keys(parsed).length > 0) {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: parsed, ts }));
      }
      sessionStorage.setItem('last_stats_fetch', String(ts));
      window.dispatchEvent(new Event('stats-updated'));
    } catch {}
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    fetchStats(watchlist.map(p => p.id), true);
  }, [watchlist, hydrated, fetchStats]);

  useEffect(() => {
    if (!hydrated || watchlist.length === 0) return;
    const tick = () => {
      fetchStats(watchlist.map(p => p.id));
      pollTimer.current = setTimeout(tick, POLL_INTERVAL);
    };
    pollTimer.current = setTimeout(tick, POLL_INTERVAL);
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [watchlist, hydrated, fetchStats]);

  const handleOpenSelector = useCallback((mode: 'conference' | 'all-teams' | 'search' = 'conference') => {
    if (isFull) { setShowToast(true); return; }
    setSelectorTarget('mine');
    setSelectorMode(mode);
    setSelectorOpen(true);
  }, [isFull]);

  const handleOpenRivalSelector = useCallback(() => {
    setSelectorTarget('rival');
    setSelectorMode('conference');
    setSelectorOpen(true);
  }, []);

  const handleCreateRival = useCallback(() => {
    const id = createRivalTeam();
    updatePref('rivalTeamId', id);
    handleOpenRivalSelector();
  }, [createRivalTeam, updatePref, handleOpenRivalSelector]);

  const handleAddPlayer = useCallback((player: Player) => {
    const wasOneBelowCap = watchlist.length === MAX_ROSTER - 1;
    const result = addPlayer(player);
    if (result === 'full') setShowToast(true);
    else if (result === 'added' && wasOneBelowCap) setShowTeamFullSuggestion(true);
  }, [addPlayer, watchlist]);

  const sortedWatchlist = sortPlayers(watchlist, stats, prefs.sortBy);
  const hasTeams = teams.length > 0;
  const hasPlayers = watchlist.length > 0;

  const handleCreateTeamFromToast = useCallback(() => {
    createTeam();
    setShowToast(false);
  }, [createTeam]);

  const handleCreateTeamFromSuggestion = useCallback(() => {
    createTeam();
    setShowTeamFullSuggestion(false);
  }, [createTeam]);

  if (!hydrated) {
    return (
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl animate-pulse h-64"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TutorialProvider
      onOpenSelector={() => { setSelectorTarget('mine'); setSelectorMode('conference'); setSelectorOpen(true); }}
      onCloseSelector={() => setSelectorOpen(false)}
    >
      <section className="max-w-[1100px] mx-auto px-6 pt-8 pb-4">

        {/* Fantasy mode switch */}
        {(hasPlayers || (fantasyOn && hasTeams)) && (
          <div className="flex flex-wrap justify-end gap-2 mb-3">
            {hasPlayers && (
              <FantasyToggle
                on={prefs.noSpoilers}
                onChange={v => updatePref('noSpoilers', v)}
                label="No spoilers"
                icon="eye"
              />
            )}
            {hasPlayers && (
              <FantasyToggle on={fantasyOn} onChange={v => updatePref('fantasyMode', v)} beta />
            )}
            {fantasyOn && hasTeams && (
              <FantasyToggle
                on={prefs.h2hMode}
                onChange={v => updatePref('h2hMode', v)}
                label="Head to head matchup"
              />
            )}
          </div>
        )}

        {/* Beta notice, visible whenever fantasy mode is on */}
        {fantasyOn && (
          <p
            className="flex items-center justify-end gap-2 font-body text-xs mb-3 text-right"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span
              className="font-mono text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5 flex-shrink-0"
              style={{ background: 'rgba(var(--skin-primary-rgb),0.2)', color: 'var(--color-text-primary)' }}
            >
              Beta
            </span>
            Fantasy mode is new. Values and live data are still being fine-tuned.
          </p>
        )}

        {/* Hero */}
        <div className={`mb-4 ${hasTeams ? 'text-center' : ''}`}>
          {hasTeams ? (
            hasPlayers ? (
              <>
                <h1
                  className="font-display font-800 text-3xl uppercase tracking-wide leading-tight"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Welcome to your courtside seats
                </h1>
                <p
                  className="font-body mt-3 leading-snug"
                  style={{ color: 'var(--color-text-secondary)', fontSize: '1.05rem' }}
                >
                  Ready to expand your roster?<br />
                  You can track up to 15 players per team.
                </p>
                <button
                  onClick={() => handleOpenSelector('conference')}
                  aria-label="Add more players to your roster"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
                  style={{ background: '#000000', color: 'white', boxShadow: '0 4px 18px rgba(0,0,0,0.45)' }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Add Players
                </button>
              </>
            ) : (
              <>
                <p
                  className="font-body leading-snug"
                  style={{ color: 'var(--color-text-secondary)', fontSize: '1.05rem' }}
                >
                  This team is empty.<br />
                  Add up to 15 players to start tracking their stats.
                </p>
                <button
                  onClick={() => handleOpenSelector('conference')}
                  aria-label="Add players to this team"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
                  style={{ background: '#000000', color: 'white', boxShadow: '0 4px 18px rgba(0,0,0,0.45)' }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Add Players
                </button>
              </>
            )
          ) : (
            <h1
              className="font-display font-800 uppercase tracking-tight leading-none"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--color-text-primary)' }}
            >
              Your{' '}
              <span style={{ color: 'var(--skin-primary)', WebkitTextStroke: '2px #000', paintOrder: 'stroke fill' }}>
                Roster
              </span>
            </h1>
          )}
        </div>

        {/* Progress bar */}
        {hasPlayers && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--color-progress-bg)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(watchlist.length / MAX_ROSTER) * 100}%`,
                  background: watchlist.length >= MAX_ROSTER
                    ? 'var(--neon-red)'
                    : 'linear-gradient(90deg, var(--skin-primary), var(--skin-secondary))',
                }}
              />
            </div>
            <span
              className="font-mono text-[10px] uppercase tracking-wider whitespace-nowrap"
              style={{ color: watchlist.length >= MAX_ROSTER ? 'var(--neon-red)' : 'var(--color-text-secondary)' }}
            >
              {watchlist.length >= MAX_ROSTER
                ? '15 / 15 — Roster full'
                : `${watchlist.length} / ${MAX_ROSTER} players`}
            </span>
          </div>
        )}

        {/* Team title + switcher — only once a team exists (created on first player add) */}
        {hasTeams && activeTeam && (
          <TeamSwitcher
            teams={teams}
            activeTeam={activeTeam}
            onSwitch={switchTeam}
            onCreate={createTeam}
            onRename={renameTeam}
            onDelete={deleteTeam}
            actions={
              hasPlayers ? (
                <button
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-display font-600 uppercase tracking-wider text-xs transition-all duration-200 hover:scale-105"
                  style={{
                    border: '1px solid var(--skin-primary)',
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-hover)',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                  </svg>
                  Share my team
                </button>
              ) : undefined
            }
          />
        )}

        {/* Fantasy: roster status strip */}
        {fantasyOn && hasPlayers && !h2hOn && (
          fantasyReady ? (
            <RosterStatusStrip players={watchlist} data={fantasy.data} injuryOk={fantasy.injuryOk} />
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-widest mb-4 text-center"
              style={{ color: 'var(--color-text-secondary)' }}>
              Loading fantasy data…
            </p>
          )
        )}

        {/* Head-to-head matchup (replaces the grid while it is switched on) */}
        {h2hOn && activeTeam && (
          <HeadToHead
            mine={activeTeam}
            rival={rivalTeam}
            otherTeams={otherTeams}
            maxRoster={MAX_ROSTER}
            onRemove={(teamId, playerId) =>
              teamId === activeTeam.id ? removePlayer(playerId) : removePlayer(playerId, teamId)
            }
            onRestore={restorePlayer}
            onAddMine={() => handleOpenSelector('conference')}
            onAddRival={handleOpenRivalSelector}
            onPickRival={id => updatePref('rivalTeamId', id)}
            onClearRival={() => updatePref('rivalTeamId', '')}
            onCreateRival={handleCreateRival}
          />
        )}

        {/* Player grid */}
        {hasPlayers && !h2hOn && (
          <>
            <div ref={gridRef} className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-2">
              {sortedWatchlist.map((player, i) => (
                <div
                  key={player.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                >
                  <PlayerCard
                    player={player}
                    stats={stats[player.id] ?? null}
                    loading={loadingStats && !stats[player.id]}
                    onRemove={removePlayer}
                    fantasyOn={fantasyOn}
                    fantasy={fantasy.data[player.id] ?? null}
                    hideResult={prefs.noSpoilers}
                  />
                </div>
              ))}
            </div>
            <ScrollArrow gridRef={gridRef} playerCount={watchlist.length} />
            {fantasyOn && fantasyReady && (
              <div className="mb-4">
                <TeamStrengths players={watchlist} data={fantasy.data} />
                <HotColdList players={watchlist} data={fantasy.data} />
              </div>
            )}
          </>
        )}

        {/* Tip boxes — always visible */}
        <EmptyState
          onOpenSelector={handleOpenSelector}
          hasPlayers={hasPlayers}
          onAddPlayer={handleAddPlayer}
        />
      </section>

      {shareOpen && activeTeam && (
        <ShareTeamModal
          teamName={activeTeam.name}
          players={sortedWatchlist}
          fantasyOn={fantasyOn && fantasyReady}
          data={fantasy.data}
          onClose={() => setShareOpen(false)}
        />
      )}

      {selectorOpen && selectorTarget === 'rival' && rivalTeam && (
        <PlayerSelector
          onAdd={player => { addPlayer(player, rivalTeam.id); }}
          onAddMany={list => list.forEach(p => addPlayer(p, rivalTeam.id))}
          slotsLeft={MAX_ROSTER - rivalTeam.players.length}
          onRemove={id => removePlayer(id, rivalTeam.id)}
          isWatching={id => rivalTeam.players.some(p => p.id === id)}
          isFull={rivalTeam.players.length >= MAX_ROSTER}
          onClose={() => setSelectorOpen(false)}
          initialMode="conference"
        />
      )}

      {selectorOpen && selectorTarget === 'mine' && (
        <PlayerSelector
          onAdd={handleAddPlayer}
          onAddMany={(list) => list.forEach(p => addPlayer(p))}
          slotsLeft={MAX_ROSTER - watchlist.length}
          onRemove={removePlayer}
          isWatching={isWatching}
          isFull={isFull}
          onClose={() => setSelectorOpen(false)}
          initialMode={selectorMode}
        />
      )}

      {showToast && (
        <Toast
          title="This team is full"
          subtitle="Each team tracks up to 15 players. Start a new team to keep building your collection."
          onClose={() => setShowToast(false)}
          actionLabel="New Team"
          onAction={handleCreateTeamFromToast}
        />
      )}

      {showTeamFullSuggestion && (
        <ConfirmDialog
          title="Want to track more players?"
          body="Add another team using the dropdown menu."
          primaryLabel="Add a team"
          secondaryLabel="Got it"
          onPrimary={handleCreateTeamFromSuggestion}
          onSecondary={() => setShowTeamFullSuggestion(false)}
        />
      )}
    </TutorialProvider>
  );
}
