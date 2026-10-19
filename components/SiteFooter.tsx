'use client';

import { useEffect } from 'react';

// 1) Small print at the very bottom of every page.
// 2) Counts the visit anonymously using a random ID kept on the visitor's device.
//    No names, emails or other personal details.
//    A visit is counted once per browser session, and once more on each new day
//    if the page/app was simply left open overnight (days are in Israel time,
//    the same as the /hq page).

const ID_KEY = 'courtside_vid';
const SENT_KEY = 'courtside_visit_sent';   // sessionStorage: the day (Israel time) this session was last counted
const IGNORE_KEY = 'courtside_ignore';     // set on a device when the owner presses the button on /hq

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

// Same day format the server uses (Israel time), e.g. 2026-10-14.
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function countVisit() {
  try {
    if (window.location.pathname.startsWith('/hq')) return; // the owner's stats page isn't a visit
    if (localStorage.getItem(IGNORE_KEY) === '1') return;   // a device the owner chose not to count

    const today = todayKey();
    if (sessionStorage.getItem(SENT_KEY) === today) return; // already counted for this session today

    let id = localStorage.getItem(ID_KEY);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = newId();
      localStorage.setItem(ID_KEY, id);
    }
    sessionStorage.setItem(SENT_KEY, today);
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      keepalive: true,
    })
      .then(res => {
        // If it wasn't saved, allow another try next time the page is shown.
        if (!res.ok) { try { sessionStorage.removeItem(SENT_KEY); } catch { /* ignore */ } }
      })
      .catch(() => {
        try { sessionStorage.removeItem(SENT_KEY); } catch { /* ignore */ }
      });
  } catch {
    // Storage blocked (e.g. some private modes): skip counting, nothing breaks.
  }
}

export default function SiteFooter() {
  useEffect(() => {
    countVisit();
    // Someone who leaves the page (or the installed app) open overnight and
    // comes back the next day still counts as a visit on that new day.
    const onShow = () => { if (document.visibilityState === 'visible') countVisit(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, []);

  return (
    <footer
      className="relative px-5 pt-6 text-center font-body"
      style={{
        fontSize: 10,
        lineHeight: 1.5,
        color: 'var(--color-text-secondary)',
        opacity: 0.75,
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      © HaDorban. All rights reserved. Visits are counted anonymously using a random ID stored on your device.
      The counter collects no names, emails or other personal details. Your roster and settings stay on your device.
    </footer>
  );
}
