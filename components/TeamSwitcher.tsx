'use client';

import { useState, useRef, useEffect } from 'react';
import type { Team } from '@/lib/useTeams';
import { MAX_ROSTER } from '@/lib/useTeams';
import EditTeamNameModal from './EditTeamNameModal';
import ConfirmDialog from './ConfirmDialog';

interface TeamSwitcherProps {
  teams: Team[];
  activeTeam: Team;
  onSwitch: (teamId: string) => void;
  onCreate: () => void;
  onRename: (teamId: string, name: string) => void;
  onDelete: (teamId: string) => void;
}

export default function TeamSwitcher({ teams, activeTeam, onSwitch, onCreate, onRename, onDelete }: TeamSwitcherProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    window.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', escHandler);
    };
  }, [dropdownOpen]);

  return (
    <div ref={wrapRef} className="relative flex flex-col items-center mb-5">
      <div className="flex items-center gap-1.5">
        <h2
          className="font-display font-800 text-xl sm:text-2xl uppercase tracking-wide leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {activeTeam.name}
        </h2>
        <button
          onClick={() => setDropdownOpen(o => !o)}
          aria-label="Switch teams"
          aria-expanded={dropdownOpen}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg
            viewBox="0 0 24 24" width="16" height="16" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Prominent Edit Title button */}
      <button
        onClick={() => setEditOpen(true)}
        className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-display font-600 uppercase tracking-wider text-xs transition-all duration-200 hover:scale-105"
        style={{
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-hover)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--neon-orange)';
          e.currentTarget.style.color = 'var(--neon-orange)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Edit Title
      </button>

      {dropdownOpen && (
        <div
          className="absolute top-full mt-2 z-20 w-60 rounded-xl overflow-hidden"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
          }}
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {teams.map(team => {
              const isSelected = team.id === activeTeam.id;
              return (
                <button
                  key={team.id}
                  onClick={() => { onSwitch(team.id); setDropdownOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{ background: isSelected ? 'rgba(255,107,43,0.1)' : 'transparent' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-hover)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ border: `2px solid ${isSelected ? 'var(--neon-orange)' : 'var(--color-border)'}` }}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--neon-orange)' }} />}
                  </div>
                  <span
                    className="font-body text-sm flex-1 truncate"
                    style={{ color: isSelected ? 'var(--neon-orange)' : 'var(--color-text-primary)' }}
                  >
                    {team.name}
                  </span>
                  <span
                    className="font-mono text-[10px] flex-shrink-0"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {team.players.length}/{MAX_ROSTER}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => { onCreate(); setDropdownOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left font-display font-600 uppercase tracking-wider text-xs transition-colors"
              style={{ color: 'var(--neon-orange)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Team
            </button>
            <button
              onClick={() => { setDeleteOpen(true); setDropdownOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left font-display font-600 uppercase tracking-wider text-xs transition-colors"
              style={{ color: 'var(--neon-red)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete Team
            </button>
          </div>
        </div>
      )}

      {editOpen && (
        <EditTeamNameModal
          initialValue={activeTeam.name}
          onCancel={() => setEditOpen(false)}
          onSave={name => { onRename(activeTeam.id, name); setEditOpen(false); }}
        />
      )}

      {deleteOpen && (
        <ConfirmDialog
          title={`Delete ${activeTeam.name}?`}
          body="All the players you tracked will be removed. This action cannot be undone."
          primaryLabel="Yes, delete it"
          secondaryLabel="No, keep the team"
          primaryVariant="danger"
          onPrimary={() => { onDelete(activeTeam.id); setDeleteOpen(false); }}
          onSecondary={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
