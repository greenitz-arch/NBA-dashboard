'use client';

import { useState, useEffect, useRef } from 'react';

interface EditTeamNameModalProps {
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}

export default function EditTeamNameModal({ initialValue, onCancel, onSave }: EditTeamNameModalProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSave) onSave(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'var(--color-overlay)' }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl p-6 w-full max-w-sm"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        <h3
          className="font-display font-700 text-lg uppercase tracking-wide mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Edit Team Name
        </h3>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          maxLength={40}
          placeholder="Team name"
          className="w-full px-3 py-2.5 rounded-xl font-body text-sm mb-5 outline-none"
          style={{
            background: 'var(--color-input-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--neon-orange)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
            style={{
              background: 'var(--neon-orange)',
              color: 'white',
              boxShadow: 'var(--glow-orange)',
              opacity: canSave ? 1 : 0.5,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
