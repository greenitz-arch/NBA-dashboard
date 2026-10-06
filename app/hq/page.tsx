'use client';

import { useState, useEffect } from 'react';
import type { VisitSummary } from '@/lib/visitStats';

// Private visit-counter page. Needs the password you set in Netlify (STATS_PASSWORD).
const PW_KEY = 'courtside_hq_pw';       // sessionStorage: stay signed in until the tab closes
const IGNORE_KEY = 'courtside_ignore';  // localStorage: don't count this device's visits

export default function HqPage() {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<VisitSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ignoring, setIgnoring] = useState(false);

  async function load(pw: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/visit-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(body as VisitSummary);
        try {
          sessionStorage.setItem(PW_KEY, pw);
          localStorage.setItem(IGNORE_KEY, '1'); // stop counting your own visits on this device
          setIgnoring(true);
        } catch { /* ignore */ }
      } else if (body?.error === 'wrong-password') {
        setError('Wrong password.');
        try { sessionStorage.removeItem(PW_KEY); } catch { /* ignore */ }
      } else if (body?.error === 'not-configured') {
        setError('No password is set yet. Add STATS_PASSWORD in Netlify (Site configuration → Environment variables), then redeploy.');
      } else {
        setError('Visit storage isn\'t available here. It only works on the live site.');
      }
    } catch {
      setError('Could not reach the server.');
    }
    setLoading(false);
  }

  useEffect(() => {
    try {
      setIgnoring(localStorage.getItem(IGNORE_KEY) === '1');
      const saved = sessionStorage.getItem(PW_KEY);
      if (saved) { setPassword(saved); load(saved); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card: React.CSSProperties = {
    background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 16px',
  };
  const max = data ? Math.max(1, ...data.series.map(r => r.visitors)) : 1;

  const Stat = ({ label, value, sub }: { label: string; value: number; sub?: string }) => (
    <div style={card}>
      <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, color: 'var(--color-text-primary)' }}>{value.toLocaleString()}</div>
      {sub && <div className="font-body" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</div>}
    </div>
  );

  return (
    <main className="min-h-screen px-4 py-8" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 className="font-display uppercase" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-primary)' }}>
        Courtside HQ
      </h1>

      {!data && (
        <form
          onSubmit={e => { e.preventDefault(); load(password); }}
          className="mt-5 flex gap-2"
        >
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="flex-1 px-3 py-2 rounded-lg font-body text-sm"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider"
            style={{ background: 'var(--neon-orange)', color: '#fff', opacity: loading || !password ? 0.5 : 1 }}
          >
            {loading ? '…' : 'Open'}
          </button>
        </form>
      )}
      {error && <p className="mt-3 font-body text-sm" style={{ color: '#ff6b7a' }}>{error}</p>}

      {data && (
        <>
          <p className="mt-1 font-body text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {data.since ? `Counting since ${data.since}` : 'No visits recorded yet'} · days are in Israel time
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="Unique visitors" value={data.totals.visitors} sub="devices, all time" />
            <Stat label="Total visits" value={data.totals.visits} sub="all time" />
            <Stat label="Today" value={data.todayStats.visitors} sub={`${data.todayStats.visits} visits · ${data.todayStats.newVisitors} new`} />
            <Stat label="Returning" value={data.totals.returning} sub="came back on another day" />
            <Stat label="Last 7 days" value={data.last7.visitors} sub={`${data.last7.visits} visits`} />
            <Stat label="Last 30 days" value={data.last30.visitors} sub={`${data.last30.visits} visits`} />
          </div>

          <h2 className="mt-7 mb-2 font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--color-text-secondary)' }}>
            Unique visitors per day (last 30 days)
          </h2>
          <div style={card}>
            {[...data.series].reverse().map(r => (
              <div key={r.date} className="flex items-center gap-2" style={{ fontSize: 11, padding: '2px 0' }}>
                <span className="font-mono" style={{ width: 78, color: 'var(--color-text-secondary)' }}>{r.date.slice(5)}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.15)' }}>
                  <div style={{ width: `${(r.visitors / max) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--neon-orange)' }} />
                </div>
                <span className="font-mono" style={{ width: 70, textAlign: 'right', color: 'var(--color-text-primary)' }}>
                  {r.visitors} <span style={{ color: 'var(--color-text-secondary)' }}>/ {r.visits}</span>
                </span>
              </div>
            ))}
            <p className="font-body" style={{ fontSize: 11, marginTop: 6, color: 'var(--color-text-secondary)' }}>Numbers on the right: visitors / visits.</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={() => load(password)} disabled={loading}
              className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            {ignoring && (
              <button
                onClick={() => { try { localStorage.removeItem(IGNORE_KEY); } catch { /* ignore */ } setIgnoring(false); }}
                className="font-body text-xs underline" style={{ color: 'var(--color-text-secondary)' }}>
                Your own visits on this device aren&apos;t counted. Count them again
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
