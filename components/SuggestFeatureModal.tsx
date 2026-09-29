'use client';

import { useEffect, useRef, useState } from 'react';

interface SuggestFeatureModalProps {
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Sends the suggestion via Netlify Forms — no server code and no API key.
// Netlify reads form submissions posted to "/" (url-encoded, with a
// "form-name" field) and forwards them to whatever email address is set
// in the site's Netlify dashboard under Site settings → Forms →
// Form notifications. That's the one manual, one-time step needed for
// this to reach an inbox — nothing about the address lives in this code.
//
// Netlify only picks up a form's fields if that exact <form> (same
// "name", same field names) also exists in a plain HTML file at build
// time — see public/__forms.html, which exists solely for that purpose.
// ─────────────────────────────────────────────────────────────────────────

const FORM_NAME = 'feature-suggestions';

function encode(data: Record<string, string>): string {
  return Object.keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
}

export default function SuggestFeatureModal({ onClose }: SuggestFeatureModalProps) {
  const [idea, setIdea] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = idea.trim();
    if (!trimmed) {
      setError('Enter an idea first');
      return;
    }
    setError('');
    setStatus('sending');
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({ 'form-name': FORM_NAME, idea: trimmed, email: email.trim() }),
      });
      if (!res.ok) throw new Error(`Form submit error ${res.status}`);
      setStatus('sent');
    } catch {
      // Most likely: running locally, where Netlify's form endpoint doesn't
      // exist yet. Fails quietly back to the form rather than showing a
      // scary error — it'll work once deployed.
      setStatus('idle');
      setError("Couldn't send that — check your connection and try again");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'var(--color-overlay)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {status === 'sent' ? (
          <>
            <h3
              className="font-display font-800 uppercase tracking-wide text-xl mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Thanks!
            </h3>
            <p className="font-body text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
              Your idea's been sent. We read every one.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm"
              style={{ background: '#000000', color: 'white' }}
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3
              className="font-display font-800 uppercase tracking-wide text-xl leading-tight mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Got an idea for Courtside?
            </h3>
            <p className="font-body text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              We are always keen to hear.
            </p>

            <label
              className="block font-mono text-[10px] uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Your idea
            </label>
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={e => { setIdea(e.target.value); if (error) setError(''); }}
              placeholder="e.g. Let me compare two players side by side..."
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 font-body text-sm mb-1 resize-none"
              style={{
                background: 'var(--color-input-bg)',
                border: `1px solid ${error ? 'var(--neon-red)' : 'var(--color-border)'}`,
                color: 'var(--color-text-primary)',
              }}
            />
            {error && (
              <p className="font-body text-xs mb-2" style={{ color: 'var(--neon-red)' }}>
                {error}
              </p>
            )}

            <label
              className="block font-mono text-[10px] uppercase tracking-widest mb-1.5 mt-3"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Your email <span style={{ opacity: 0.6 }}>(optional, if you want a reply)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@email.com"
              className="w-full rounded-xl px-3 py-2.5 font-body text-sm mb-5"
              style={{
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-opacity"
              style={{ background: '#000000', color: 'white', opacity: status === 'sending' ? 0.6 : 1 }}
            >
              {status === 'sending' ? 'Sending...' : 'Send suggestion'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
