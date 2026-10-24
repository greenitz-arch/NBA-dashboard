// lib/whatsNew.ts
// "What's New" pop-up: shown once to people who already used Courtside, never to first-time visitors.
// Change WHATS_NEW_VERSION the next time you want everyone to see a fresh announcement.

export const WHATS_NEW_VERSION = 'oct-2026-b';
const SEEN_KEY = 'courtside_whats_new_seen';

// Worked out once, when the page loads (before this visit creates its own visitor id).
const RETURNING_AT_LOAD: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try { return !!localStorage.getItem('courtside_vid'); } catch { return false; }
})();
const SHARE_AT_LOAD: boolean = typeof window !== 'undefined' && /[?&]share=/.test(window.location.search);

// Add ?whatsnew=1 to the address to preview the pop-up again, whatever the saved state.
export const WHATS_NEW_FORCED: boolean = typeof window !== 'undefined' && /[?&]whatsnew=1(&|$)/.test(window.location.search);

export function markWhatsNewSeen() {
  try { localStorage.setItem(SEEN_KEY, WHATS_NEW_VERSION); } catch { /* storage blocked: it may show again */ }
}

// hasTeams: the person already has saved teams (a returning visitor from before visits were counted).
export function shouldShowWhatsNew(hasTeams: boolean): boolean {
  try {
    if (WHATS_NEW_FORCED) return true;
    if (localStorage.getItem(SEEN_KEY) === WHATS_NEW_VERSION) return false;
    if (!RETURNING_AT_LOAD && !hasTeams) {
      markWhatsNewSeen(); // first-time visitor: nothing is "new" to them
      return false;
    }
    if (SHARE_AT_LOAD) return false; // the shared-team pop-up goes first; this one waits for the next visit
    return true;
  } catch {
    return false;
  }
}
