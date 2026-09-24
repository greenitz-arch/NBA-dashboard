'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';

// Draws a small circular badge (team colors + abbreviation) to use as the
// browser tab favicon while a skin is active. Not the team's real logo —
// see SkinBackdrop.tsx for why — just a colored badge for quick recognition.
function drawFavicon(primary: string, secondary: string, label: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, primary);
  grad.addColorStop(1, secondary);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 3), 32, 34);
  return canvas.toDataURL('image/png');
}

function setFaviconHref(href: string | null) {
  const existing = document.querySelector<HTMLLinkElement>('link[data-skin-favicon]');
  if (href === null) {
    // No skin active — remove our injected icon so the page returns to
    // whatever the browser's true default is (this project ships no static
    // favicon file, so "reverting" means having none, not pointing at one).
    existing?.remove();
    return;
  }
  let link = existing;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.setAttribute('data-skin-favicon', 'true');
    document.head.appendChild(link);
  }
  link.href = href;
}

const DEFAULT_TITLE = 'Courtside — NBA Player Dashboard';

export default function SkinEffects() {
  const { activeSkin } = useTheme();
  const isFirstRun = useRef(true);
  const lastAbbr = useRef<string | null>(null);

  useEffect(() => {
    const abbr = activeSkin?.abbr ?? null;
    if (abbr === lastAbbr.current) return;
    lastAbbr.current = abbr;

    // Tab title + favicon
    if (activeSkin) {
      document.title = `${activeSkin.abbr} Skin — Courtside`;
      const dataUrl = drawFavicon(activeSkin.primary, activeSkin.secondary, activeSkin.abbr);
      if (dataUrl) setFaviconHref(dataUrl);
    } else {
      document.title = DEFAULT_TITLE;
      setFaviconHref(null);
    }

    // Skip the sweep animation on first mount — only play it on an actual
    // switch the person triggers, not on page load.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const sweep = document.getElementById('skinSweep');
    if (sweep) {
      sweep.classList.remove('active');
      // Force reflow so the animation can retrigger on consecutive switches.
      void sweep.offsetWidth;
      sweep.classList.add('active');
    }
  }, [activeSkin]);

  return (
    <div className="skin-sweep" id="skinSweep">
      <div className="skin-sweep-band" />
    </div>
  );
}
