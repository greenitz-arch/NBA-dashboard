'use client';

import { useEffect } from 'react';

// 1) Small print at the very bottom of every page.
// 2) Counts the visit anonymously (once per browser session) using a random ID
//    kept on the visitor's device. No names, emails or other personal details.

const ID_KEY = 'courtside_vid';
const SENT_KEY = 'courtside_visit_sent';   // sessionStorage: already counted this session
const IGNORE_KEY = 'courtside_ignore';     // set on the owner's device by the /hq page

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

export default function SiteFooter() {
  useEffect(() => {
    try {
      if (window.location.pathname.startsWith('/hq')) return; // the owner's stats page isn't a visit
      if (localStorage.getItem(IGNORE_KEY) === '1') return;   // owner's own device
      if (sessionStorage.getItem(SENT_KEY)) return;           // already counted this session

      let id = localStorage.getItem(ID_KEY);
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        id = newId();
        localStorage.setItem(ID_KEY, id);
      }
      sessionStorage.setItem(SENT_KEY, '1');
      fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        keepalive: true,
      }).catch(() => { /* counting is best-effort */ });
    } catch {
      // Storage blocked (e.g. some private modes): skip counting, nothing breaks.
    }
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
