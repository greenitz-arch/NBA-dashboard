'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// First-time tutorial ("Not sure how it works? »")
//
// This is a guided, 5-step walkthrough that runs *on top of* the real
// PlayerSelector dialog — it does not re-implement the conference/team/
// roster screens. It only renders:
//   1) a small floating tip card (with copy + Back/Next/dots), and
//   2) a spotlight ring around whichever real button the current step
//      wants the visitor to click.
//
// PlayerSelector.tsx reads `step`/`picked` from this context to know which
// options to dim, and calls setTarget(...) so this component knows where
// to draw the ring. The worked example is always East → Boston Celtics →
// Jayson Tatum, confirmed in the storyboard/mockup phase.
// ─────────────────────────────────────────────────────────────────────────

interface TutorialContextValue {
  step: number; // 0 = inactive, 1-5 = active steps
  picked: { east: boolean; bos: boolean };
  showRemoveHint: boolean;
  hintPlayerId: number | null;
  start: () => void;
  skip: () => void;
  closeAll: () => void;
  toStep2: () => void;
  backToStep1: () => void;
  pickEast: () => void;
  toStep3: () => void;
  backToStep2: () => void;
  pickBos: () => void;
  toStep4: () => void;
  backToStep3: () => void;
  confirmAdd: (playerId: number) => void;
  backToStep4: () => void;
  finish: () => void;
  setTarget: (key: string, el: HTMLElement | null) => void;
}

const noop = () => {};
const TutorialContext = createContext<TutorialContextValue>({
  step: 0,
  picked: { east: false, bos: false },
  showRemoveHint: false,
  hintPlayerId: null,
  start: noop, skip: noop, closeAll: noop,
  toStep2: noop, backToStep1: noop, pickEast: noop,
  toStep3: noop, backToStep2: noop, pickBos: noop,
  toStep4: noop, backToStep3: noop,
  confirmAdd: noop, backToStep4: noop, finish: noop,
  setTarget: noop,
});

export const useTutorial = () => useContext(TutorialContext);

export function TutorialProvider({
  onOpenSelector,
  onCloseSelector,
  children,
}: {
  onOpenSelector: () => void;
  onCloseSelector: () => void;
  children: React.ReactNode;
}) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState({ east: false, bos: false });
  const [showRemoveHint, setShowRemoveHint] = useState(false);
  const [hintPlayerId, setHintPlayerId] = useState<number | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targets = useRef<Record<string, HTMLElement | null>>({});

  const setTarget = useCallback((key: string, el: HTMLElement | null) => {
    targets.current[key] = el;
  }, []);

  const start = useCallback(() => { setStep(1); }, []);
  const skip = useCallback(() => { onCloseSelector(); setStep(0); setPicked({ east: false, bos: false }); }, [onCloseSelector]);
  const closeAll = skip;

  const toStep2 = useCallback(() => { onOpenSelector(); setStep(2); }, [onOpenSelector]);
  const backToStep1 = useCallback(() => { onCloseSelector(); setStep(1); }, [onCloseSelector]);
  const pickEast = useCallback(() => { setPicked(p => ({ ...p, east: true })); }, []);
  const toStep3 = useCallback(() => { setStep(3); }, []);
  const backToStep2 = useCallback(() => { setStep(2); }, []);
  const pickBos = useCallback(() => { setPicked(p => ({ ...p, bos: true })); }, []);
  const toStep4 = useCallback(() => { setStep(4); }, []);
  const backToStep3 = useCallback(() => { setStep(3); }, []);
  const backToStep4 = useCallback(() => { setStep(4); }, []);

  // Clicking the real "+ Add" on Tatum finishes the guided part immediately —
  // no extra "Next" click, since the add itself is the completing action.
  const confirmAdd = useCallback((playerId: number) => {
    setHintPlayerId(playerId);
    setStep(5);
  }, []);

  const finish = useCallback(() => {
    onCloseSelector();
    setStep(0);
    setPicked({ east: false, bos: false });
    setShowRemoveHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowRemoveHint(false), 8000);
  }, [onCloseSelector]);

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);

  return (
    <TutorialContext.Provider value={{
      step, picked, showRemoveHint, hintPlayerId,
      start, skip, closeAll,
      toStep2, backToStep1, pickEast,
      toStep3, backToStep2, pickBos,
      toStep4, backToStep3,
      confirmAdd, backToStep4, finish,
      setTarget,
    }}>
      {children}
      <TutorialOverlay targets={targets} />
    </TutorialContext.Provider>
  );
}

function dots(active: number) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className="rounded-full" style={{
          width: 6, height: 6,
          background: n === active ? 'var(--neon-orange)' : 'var(--color-border)',
        }} />
      ))}
    </div>
  );
}

function TutorialOverlay({ targets }: { targets: React.MutableRefObject<Record<string, HTMLElement | null>> }) {
  const t = useTutorial();
  const cardRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const card = cardRef.current;
    const ring = ringRef.current;
    if (!card) return;

    const ringKey = t.step === 2 ? 'east' : t.step === 3 ? 'bos' : t.step === 4 ? 'add-tatum' : null;
    const ringTarget = ringKey ? targets.current[ringKey] : null;

    // Steps 2-4 point the card at the actual highlighted button (below it,
    // or above if there's no room) so the card never sits on top of the
    // thing the visitor needs to click. Step 1 (nothing open yet) anchors
    // under the trigger link; step 5 (nothing highlighted) anchors under
    // the real dialog's header.
    const anchor = ringTarget || targets.current[t.step === 1 ? 'trigger' : 'dialog'];
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const mw = card.offsetWidth || 320;
      const mh = card.offsetHeight || 160;
      let left = r.left + r.width / 2 - mw / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - mw - 12));
      const gap = 16;
      let top = r.bottom + gap;
      if (top + mh > window.innerHeight - 12) top = Math.max(12, r.top - mh - gap);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.visibility = 'visible';
    }

    if (ring) {
      if (ringTarget) {
        const rr = ringTarget.getBoundingClientRect();
        ring.style.display = 'block';
        ring.style.top = `${rr.top - 6}px`;
        ring.style.left = `${rr.left - 6}px`;
        ring.style.width = `${rr.width + 12}px`;
        ring.style.height = `${rr.height + 12}px`;
      } else {
        ring.style.display = 'none';
      }
    }
  }, [t.step, targets]);

  useEffect(() => {
    if (t.step === 0) return;
    reposition();
    const id = setInterval(reposition, 200); // handles PlayerSelector's own open/close animation
    window.addEventListener('resize', reposition);
    return () => { clearInterval(id); window.removeEventListener('resize', reposition); };
  }, [t.step, reposition]);

  if (t.step === 0) return null;

  return (
    <>
      <div
        ref={ringRef}
        className="fixed rounded-xl pointer-events-none z-[60]"
        style={{ border: '2.5px solid var(--neon-orange)', boxShadow: '0 0 0 3px rgba(255,107,43,0.2)', display: 'none', transition: 'all .2s ease' }}
      />
      <div
        ref={cardRef}
        className="fixed z-[60] rounded-2xl p-4"
        style={{
          visibility: 'hidden', width: 320, maxWidth: 'calc(100vw - 24px)',
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
        }}
      >
        {t.step === 1 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-700 text-base uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>Quick Start</span>
              <button onClick={t.closeAll} aria-label="Close tutorial" style={{ color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <p className="font-body text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Let&apos;s add your first player — takes about 10 seconds.
            </p>
            <p className="font-body text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
              We&apos;ll do it live using Boston Celtics guard Jayson Tatum as the example.
            </p>
            <div className="flex items-center justify-between mt-3">
              <button onClick={t.skip} className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>Skip tour</button>
              {dots(1)}
              <button onClick={t.toStep2} className="font-mono text-xs px-3 py-1.5 rounded-lg font-600"
                style={{ background: 'var(--neon-orange)', color: '#fff' }}>Next →</button>
            </div>
          </>
        )}

        {t.step === 2 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs" style={{ color: t.picked.east ? '#4ade80' : 'var(--neon-orange)' }}>
                {t.picked.east ? '✓ Nice — now click Next to continue' : '👉 Click the highlighted conference to continue'}
              </span>
              <button onClick={t.closeAll} aria-label="Close tutorial" style={{ color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <p className="font-body text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Start by choosing a conference. We&apos;ll go East → Boston Celtics.
            </p>
            <div className="flex items-center justify-between mt-3">
              <button onClick={t.backToStep1} className="font-mono text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>← Back</button>
              {dots(2)}
              <button onClick={t.toStep3} disabled={!t.picked.east} className="font-mono text-xs px-3 py-1.5 rounded-lg font-600"
                style={{ background: t.picked.east ? 'var(--neon-orange)' : 'var(--color-muted)', color: t.picked.east ? '#fff' : 'var(--color-text-secondary)', cursor: t.picked.east ? 'pointer' : 'not-allowed' }}>Next →</button>
            </div>
          </>
        )}

        {t.step === 3 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs" style={{ color: t.picked.bos ? '#4ade80' : 'var(--neon-orange)' }}>
                {t.picked.bos ? '✓ Nice — now click Next to continue' : '👉 Click the highlighted team to continue'}
              </span>
              <button onClick={t.closeAll} aria-label="Close tutorial" style={{ color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <p className="font-body text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Tap a team name to load its live roster. Let&apos;s pick the Celtics.
            </p>
            <div className="flex items-center justify-between mt-3">
              <button onClick={t.backToStep2} className="font-mono text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>← Back</button>
              {dots(3)}
              <button onClick={t.toStep4} disabled={!t.picked.bos} className="font-mono text-xs px-3 py-1.5 rounded-lg font-600"
                style={{ background: t.picked.bos ? 'var(--neon-orange)' : 'var(--color-muted)', color: t.picked.bos ? '#fff' : 'var(--color-text-secondary)', cursor: t.picked.bos ? 'pointer' : 'not-allowed' }}>Next →</button>
            </div>
          </>
        )}

        {t.step === 4 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs" style={{ color: 'var(--neon-orange)' }}>👉 Click + Add next to Tatum to continue</span>
              <button onClick={t.closeAll} aria-label="Close tutorial" style={{ color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <p className="font-body text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Hit <b>+ Add</b> next to any player. Tatum&apos;s row confirms he&apos;s officially on your roster — and moves you straight to the last step.
            </p>
            <div className="flex items-center justify-between mt-3">
              <button onClick={t.backToStep3} className="font-mono text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>← Back</button>
              {dots(4)}
              <span />
            </div>
          </>
        )}

        {t.step === 5 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-700 text-base uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>Nice work</span>
              <button onClick={t.finish} aria-label="Close tutorial" style={{ color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <p className="font-body text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Jayson Tatum is on your roster now — check the page behind this popup. Repeat these steps to add up to 15 players. This guide is always one tap away if you need it again.
            </p>
            <div className="flex items-center justify-between mt-3">
              <button onClick={t.backToStep4} className="font-mono text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>← Back</button>
              {dots(5)}
              <button onClick={t.finish} className="font-mono text-xs px-3 py-1.5 rounded-lg font-600" style={{ background: 'var(--neon-orange)', color: '#fff' }}>Got it</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
