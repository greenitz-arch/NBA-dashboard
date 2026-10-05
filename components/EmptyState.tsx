'use client';

import { useEffect, useRef, useState } from 'react';
import { useTutorial } from './TutorialGuide';
import MrLineaAnimation, { MR_LINEA_DURATION_MS } from './MrLineaAnimation';
import PlayerSuggestions from './PlayerSuggestions';
import SuggestFeatureModal from './SuggestFeatureModal';
import type { Player } from '@/lib/nba';

interface EmptyStateProps {
  onOpenSelector: (mode?: 'conference' | 'all-teams' | 'search') => void;
  hasPlayers: boolean;
  onAddPlayer?: (player: Player) => void;
}

// The "First time here?" nudge bubble: shows once per page load, only on the
// empty state, after NUDGE_DELAY_MS with no click/tap/keypress.
let nudgeDone = false;
const NUDGE_DELAY_MS = 9000;

const tips = [
  {
    id: 'browse',
    title: 'Browse by Team',
    desc: 'Find your favorite players by team',
    mode: 'all-teams' as 'all-teams' | 'search' | undefined,
    disabled: false,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M12 2c0 0-4 4-4 10s4 10 4 10M12 2c0 0 4 4 4 10s-4 10-4 10M2 12h20"/>
        <path d="M3.5 7h17M3.5 17h17"/>
      </svg>
    ),
  },
  {
    id: 'search',
    title: 'Quick Search',
    desc: 'Search any player by name instantly',
    mode: 'search' as const,
    disabled: false,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    id: 'smart',
    title: 'Smart Stats',
    desc: 'Standout performances from last game night',
    mode: undefined,
    disabled: true,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
];

export default function EmptyState({ onOpenSelector, hasPlayers, onAddPlayer }: EmptyStateProps) {
  const tutorial = useTutorial();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const nudgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hasPlayers || nudgeDone) return;
    const timer = setTimeout(() => setShowNudge(true), NUDGE_DELAY_MS);
    // Any interaction means they're finding their way: cancel for this page load.
    const dismiss = (e: Event) => {
      const target = e.target as Node | null;
      if (target && nudgeRef.current?.contains(target)) return; // let the bubble's own click through
      clearTimeout(timer);
      nudgeDone = true;
      setShowNudge(false);
    };
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [hasPlayers]);

  return (
    <>
      {/* Empty state CTA — only when no players */}
      {!hasPlayers && (
        <div className="text-center mb-8">
          <h2
            className="font-display font-800 text-3xl uppercase tracking-wide mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Your Roster Is Empty
          </h2>
          <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Add players to track their latest game stats
          </p>
          <button
            onClick={() => onOpenSelector('conference')}
            aria-label="Add your first player"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-600 uppercase tracking-wider text-base transition-all duration-200 hover:scale-105"
            style={{ background: '#000000', color: 'white', boxShadow: '0 4px 18px rgba(0,0,0,0.45)' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Your First Player
          </button>

          <style>{`
            @keyframes courtsidePillPulse {
              0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0.45); }
              100% { box-shadow: 0 0 0 12px rgba(0,0,0,0); }
            }
            @keyframes courtsideNudgeIn {
              from { opacity: 0; transform: translate(-50%, 6px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
          <div className="flex justify-center mt-5">
            <div className="relative inline-block max-w-full">
              {showNudge && tutorial.step === 0 && (
                <button
                  ref={nudgeRef}
                  onClick={() => { nudgeDone = true; setShowNudge(false); tutorial.start(); }}
                  aria-label="First time here? Take a 30-second tour"
                  className="absolute left-1/2 bottom-full mb-3 w-[230px] rounded-xl px-3 py-2 font-body text-xs leading-snug text-center"
                  style={{ background: '#ffffff', color: '#111111', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', animation: 'courtsideNudgeIn .4s ease-out forwards' }}
                >
                  First time here? Take a 30-second tour.
                  <span aria-hidden="true" className="absolute left-1/2 -bottom-1 w-2.5 h-2.5 rotate-45"
                    style={{ background: '#ffffff', marginLeft: -5 }} />
                </button>
              )}
              <button
                ref={el => tutorial.setTarget('trigger', el)}
                onClick={tutorial.start}
                aria-label="Open the first-time tutorial"
                className="inline-flex items-center gap-2 rounded-full pl-2 pr-4 py-2 font-body text-xs sm:text-[13px] font-500 text-left"
                style={{
                  background: 'rgba(255,255,255,0.94)', color: '#111111', border: '2px solid #111111',
                  animation: 'courtsidePillPulse 1.8s ease-out infinite',
                }}
              >
                <span aria-hidden="true" className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 font-700"
                  style={{ background: '#111111', color: '#ffffff', fontSize: 13 }}>?</span>
                <span>
                  Not sure how it works? Take the quick tour{' '}
                  <span className="font-700" style={{ animation: 'tutorialChevronPulse 1.6s ease-in-out infinite' }}>»</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Building Tools — always visible */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'var(--color-divider)' }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[3px] whitespace-nowrap"
            style={{ color: 'var(--color-divider-text)' }}
          >
            Roster Building Tools
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-divider)' }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tips.map(tip => (
            <button
              key={tip.id}
              onClick={() => !tip.disabled && onOpenSelector(tip.mode)}
              disabled={tip.disabled}
              aria-label={tip.disabled ? `${tip.title} — coming soon` : tip.title}
              className="rounded-xl p-5 text-center transition-all duration-200 relative"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                opacity: tip.disabled ? 0.5 : 1,
                cursor: tip.disabled ? 'default' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!tip.disabled) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--neon-orange)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(255,107,43,0.15)';
                }
              }}
              onMouseLeave={e => {
                if (!tip.disabled) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }
              }}
            >
              {tip.disabled && (
                <span
                  className="absolute top-2 right-2 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-muted)', color: 'var(--color-text-secondary)' }}
                >
                  Soon
                </span>
              )}
              <div
                className="flex items-center justify-center mb-3"
                style={{ color: tip.disabled ? 'var(--color-text-secondary)' : 'var(--neon-orange)' }}
              >
                {tip.icon}
              </div>
              <h4
                className="font-display font-700 uppercase tracking-wide text-sm mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {tip.title}
              </h4>
              <p className="font-body text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {tip.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Quiet footer link — same visibility as the "Roster Building
            Tools" label above it (var(--color-divider-text)), so it reads
            as fine print rather than another call to action. */}
        <div className="flex justify-center mt-5">
          <button
            onClick={() => setSuggestOpen(true)}
            className="font-mono text-xs flex items-center gap-1.5"
            style={{ color: 'var(--color-divider-text)' }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Got an idea for Courtside?
          </button>
        </div>
      </div>

      {suggestOpen && <SuggestFeatureModal onClose={() => setSuggestOpen(false)} />}

      {/* Entrance animation — plays once per page load while the roster is
          empty (no loop, no "seen it" memory). */}
      {!hasPlayers && <MrLineaAnimation />}

      {/* 4 random players from ESPN's top 100, revealed once the trail line
          has finished drawing. */}
      {!hasPlayers && onAddPlayer && (
        <PlayerSuggestions
          onAdd={onAddPlayer}
          revealAfterMs={MR_LINEA_DURATION_MS + 300}
        />
      )}
    </>
  );
}
