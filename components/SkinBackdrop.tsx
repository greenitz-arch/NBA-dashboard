'use client';

import { useTheme } from './ThemeProvider';

// Generic shield + basketball-seam crest — an original shape, not modeled on
// any real team's logo geometry. Recolored per team via CSS vars set by
// ThemeProvider. Real official logos would need licensed image assets
// dropped in separately; this is the safe default when none exists.
export default function SkinBackdrop() {
  const { activeSkin } = useTheme();
  if (!activeSkin) return null;

  return (
    <>
      <div className="skin-crest" aria-hidden="true">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path d="M100,8 L184,42 L184,112 C184,155 142,184 100,198 C58,184 16,155 16,112 L16,42 Z"
                style={{ fill: 'var(--skin-primary)' }} />
          <path d="M100,8 L184,42 L184,112 C184,155 142,184 100,198 C58,184 16,155 16,112 L16,42 Z"
                fill="none" style={{ stroke: 'var(--skin-secondary)' }} strokeWidth="4" />
          <rect x="16" y="88" width="168" height="26" style={{ fill: 'var(--skin-secondary)' }} opacity="0.9" />
          <path d="M16,101 C60,101 60,101 100,101 C140,101 140,101 184,101" style={{ stroke: 'var(--skin-primary)' }} strokeWidth="2" fill="none" />
          <circle cx="100" cy="60" r="26" fill="none" style={{ stroke: 'var(--skin-secondary)' }} strokeWidth="3" />
          <path d="M100,34 L100,86 M74,60 L126,60 M82,42 C92,52 92,68 82,78 M118,42 C108,52 108,68 118,78"
                style={{ stroke: 'var(--skin-secondary)' }} strokeWidth="2.5" fill="none" />
        </svg>
      </div>
      <div className="skin-jersey-mark" aria-hidden="true">{activeSkin.abbr}</div>
    </>
  );
}
