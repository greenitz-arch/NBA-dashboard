'use client';

import { useSyncExternalStore } from 'react';

// "Add to Home Screen" support.
//  - Android / desktop Chrome and Edge: the browser hands the page an install prompt that a button can open.
//  - iPhone / iPad: Apple does not allow a site to open it, so we show a short how-to instead.
//  - Everything else: we show a generic how-to.

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'manual';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

if (typeof window !== 'undefined') {
  // Listen from the moment this file loads: the browser can offer the prompt very early.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith('android-app://')
    );
  } catch {
    return false;
  }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Browsers built into other apps (WhatsApp, Instagram, ...) cannot add to the home screen.
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|Twitter|TikTok|; wv\)/i.test(navigator.userAgent);
}

function getMode(): InstallMode {
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return 'manual';
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// 'accepted' / 'dismissed' = the browser's own prompt was shown; 'guide' = show the how-to instead.
async function install(): Promise<'accepted' | 'dismissed' | 'guide'> {
  if (!deferred) return 'guide';
  const evt = deferred;
  deferred = null; // an install prompt can only be used once
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') installed = true;
    emit();
    return choice.outcome;
  } catch {
    emit();
    return 'guide';
  }
}

export function useInstall() {
  // On the server (and during the first paint) we report "installed" so nothing flashes.
  const mode = useSyncExternalStore(subscribe, getMode, () => 'installed' as InstallMode);
  return { mode, install };
}

// ── First-time visitors ──────────────────────────────────────────────────────
// A device counts as "first time" when it has never opened Courtside before this code ran.
// The result is worked out once, when the page loads, and remembered until the person acts on it.
const NUDGE_DONE = 'courtside_install_nudge';
const NUDGE_PENDING = 'courtside_install_pending';

export const NUDGE_ELIGIBLE: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(NUDGE_DONE)) return false;
    if (localStorage.getItem(NUDGE_PENDING)) return true;
    if (!localStorage.getItem('courtside_vid')) {
      localStorage.setItem(NUDGE_PENDING, '1');
      return true;
    }
  } catch {
    // storage blocked: no big banner, the quiet button still works
  }
  return false;
})();

export function markNudgeDone() {
  try {
    localStorage.setItem(NUDGE_DONE, '1');
    localStorage.removeItem(NUDGE_PENDING);
  } catch {
    // ignore
  }
}
