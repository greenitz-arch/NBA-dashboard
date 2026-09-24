'use client';

import { NBA_TEAMS } from '@/lib/teams';
import { useTheme } from './ThemeProvider';

// A quick-switch strip of all 30 team swatches, shown right below the header
// whenever Team Skin mode is on — so switching skins doesn't require opening
// the settings menu every time. Mirrors the picker inside the settings menu;
// that one stays too, since it's where a person first turns Team Skin on.
export default function SkinPickerBar() {
  const { mode, activeSkin, setSkinTeam } = useTheme();
  if (mode !== 'skin') return null;

  return (
    <div
      className="sticky top-24 z-20 overflow-x-auto"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-2.5 flex items-center gap-3">
        <span
          className="font-mono text-[9px] uppercase tracking-widest flex-shrink-0"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Skin
        </span>
        <div className="flex gap-1.5 overflow-x-auto">
          {NBA_TEAMS.map(team => {
            const isActive = activeSkin?.abbr === team.abbr;
            return (
              <button
                key={team.abbr}
                onClick={() => setSkinTeam(team.abbr)}
                title={team.name}
                aria-label={`Use ${team.name} skin`}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${team.primary} 55%, ${team.secondary} 55%)`,
                  border: isActive ? '2px solid white' : '2px solid transparent',
                  boxShadow: isActive ? '0 0 0 2px rgba(255,255,255,0.15)' : 'none',
                }}
              >
                <span
                  className="font-display font-700 text-white"
                  style={{ fontSize: '7px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                  {team.abbr.slice(0, 2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
