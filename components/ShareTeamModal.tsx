'use client';

import { useEffect, useRef, useState } from 'react';
import type { WatchlistPlayer } from '@/lib/storage';
import { STATUS_LABEL, type PlayerFantasy } from '@/lib/fantasy';

interface ShareTeamModalProps {
  teamName: string;
  players: WatchlistPlayer[];
  fantasyOn: boolean;
  data: Record<number, PlayerFantasy>;
  onClose: () => void;
}

const W = 1080;
const ROW_H = 84;
const TOP = 300;

function cssRgb(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(v)) return v;
  } catch {
    // ignore
  }
  return fallback;
}

function isDark(rgb: string): boolean {
  const [r, g, b] = rgb.split(',').map(n => Number(n.trim()));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

// Draws the roster picture. Uses initials (not photos) on purpose: browsers
// refuse to save pictures that contain photos from other websites.
function drawRoster(
  canvas: HTMLCanvasElement,
  teamName: string,
  players: WatchlistPlayer[],
  fantasyOn: boolean,
  data: Record<number, PlayerFantasy>
) {
  const primary = cssRgb('--skin-primary-rgb', '255, 107, 43');
  const secondary = cssRgb('--skin-secondary-rgb', '255, 107, 43');
  const dark = isDark(primary);
  const ink = dark ? '#ffffff' : '#111111';
  const inkSoft = dark ? 'rgba(255,255,255,0.75)' : 'rgba(17,17,17,0.72)';
  const circle = dark ? '#ffffff' : '#111111';
  const circleText = dark ? '#111111' : '#ffffff';

  let fontFamily = 'Arial Narrow, Arial, sans-serif';
  try {
    const f = getComputedStyle(document.body).getPropertyValue('--font-display').trim();
    if (f) fontFamily = `${f}, ${fontFamily}`;
  } catch {
    // ignore
  }

  const list = fantasyOn
    ? [...players].sort((a, b) => (data[b.id]?.value ?? -1) - (data[a.id]?.value ?? -1))
    : players;

  const H = TOP + list.length * ROW_H + 130;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = `rgb(${primary})`;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgb(${secondary})`;
  ctx.fillRect(0, 0, W, 22);

  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  let size = 112;
  const title = teamName.toUpperCase();
  do {
    ctx.font = `800 ${size}px ${fontFamily}`;
    size -= 4;
  } while (ctx.measureText(title).width > W - 144 && size > 40);
  ctx.fillText(title, 72, 170);

  ctx.font = `500 34px ${fontFamily}`;
  ctx.fillStyle = inkSoft;
  ctx.fillText(`COURTSIDE ROSTER  ·  ${list.length} PLAYER${list.length === 1 ? '' : 'S'}`, 72, 230);

  ctx.fillStyle = inkSoft;
  ctx.fillRect(72, 262, W - 144, 2);

  list.forEach((p, i) => {
    const y = TOP + i * ROW_H;
    const cy = y + ROW_H / 2 - 4;
    ctx.fillStyle = circle;
    ctx.beginPath();
    ctx.arc(102, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = circleText;
    ctx.font = `700 26px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase(), 102, cy + 9);

    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = `700 40px ${fontFamily}`;
    ctx.fillText(`${p.first_name} ${p.last_name}`.toUpperCase(), 160, cy + 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = inkSoft;
    ctx.font = `500 30px ${fontFamily}`;
    ctx.fillText(`${p.team_abbreviation}${p.position ? ' · ' + p.position : ''}`, W - 72, cy + 12);

    if (fantasyOn) {
      const d = data[p.id];
      ctx.fillStyle = ink;
      ctx.font = `700 34px ${fontFamily}`;
      const label =
        d?.status && d.status !== 'healthy'
          ? STATUS_LABEL[d.status].toUpperCase()
          : d?.value != null
            ? `VALUE ${d.value}`
            : '';
      if (label) ctx.fillText(label, W - 330, cy + 12);
    }
    ctx.textAlign = 'left';
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = inkSoft;
  ctx.font = `500 30px ${fontFamily}`;
  ctx.fillText('courtsidenba.netlify.app', W / 2, H - 52);
  ctx.textAlign = 'left';
}

export default function ShareTeamModal({ teamName, players, fantasyOn, data, onClose }: ShareTeamModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    drawRoster(canvas, teamName, players, fantasyOn, data);
    try {
      setPreview(canvas.toDataURL('image/png'));
    } catch {
      setMessage("Couldn't make the picture in this browser.");
    }
    try {
      const probe = new File([''], 'x.png', { type: 'image/png' });
      setCanShare(!!navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShare(false);
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toBlob = () =>
    new Promise<Blob | null>(resolve => {
      const c = canvasRef.current;
      if (!c) return resolve(null);
      c.toBlob(b => resolve(b), 'image/png');
    });

  const fileName = `${teamName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'my-team'}.png`;

  const handleDownload = async () => {
    const blob = await toBlob();
    if (!blob) {
      setMessage("Couldn't save the picture.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMessage('Saved to your downloads.');
  };

  const handleShare = async () => {
    const blob = await toBlob();
    if (!blob) return;
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: 'image/png' })],
        title: teamName,
      });
    } catch {
      // person closed the share menu -- nothing to do
    }
  };

  const btn =
    'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share my team"
    >
      <div
        className="rounded-2xl p-4 w-full max-w-sm max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3
          className="font-display font-800 text-lg uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Share my team
        </h3>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Picture of ${teamName}`} className="w-full rounded-xl" />
        ) : (
          <p className="font-body text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {message || 'Making your picture…'}
          </p>
        )}
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {canShare && (
            <button onClick={handleShare} className={btn} style={{ background: '#000', color: '#fff' }}>
              Share
            </button>
          )}
          <button
            onClick={handleDownload}
            className={btn}
            style={canShare ? { border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } : { background: '#000', color: '#fff' }}
          >
            Download image
          </button>
          <button
            onClick={onClose}
            className={btn}
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Close
          </button>
        </div>
        <p className="font-body text-xs text-center mt-2 min-h-[16px]" style={{ color: 'var(--color-text-secondary)' }}>
          {preview ? message : ''}
        </p>
      </div>
    </div>
  );
}
