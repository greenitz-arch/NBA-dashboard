'use client';

import { useEffect, useRef, useState } from 'react';
import type { WatchlistPlayer } from '@/lib/storage';
import { STATUS_LABEL, STATUS_COLOR, type PlayerFantasy } from '@/lib/fantasy';
import { getPlayerHeadshotUrl, getEspnHeadshotUrl } from '@/lib/nba';
import { buildShareUrl } from '@/lib/shareLink';

interface ShareTeamModalProps {
  teamName: string;
  players: WatchlistPlayer[];
  fantasyOn: boolean;
  data: Record<number, PlayerFantasy>;
  onClose: () => void;
}

const W = 1080;
const MARGIN = 72;
const GRID_TOP = 290;
const COL_GAP = 20;
const ROW_GAP = 26;

type PhotoMap = Record<number, HTMLImageElement | null>;

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

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Loading the photos ───────────────────────────────────────────────────
// A picture that contains photos from other websites can only be saved if the
// photo's server allows it ("CORS"). So each photo is requested with that
// permission: if the server agrees, the photo is drawn; if not, the load fails
// and that player simply gets the initials circle. The picture always saves.

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

// The browser may already hold a copy of the photo that was saved without the
// permission mark (the player cards loaded it first), which makes the first try
// fail. A second try with a harmless extra bit on the address gets a fresh copy.
async function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  const first = await loadImage(url);
  if (first) return first;
  return loadImage(`${url}${url.includes('?') ? '&' : '?'}cors=1`);
}

async function loadPlayerPhoto(p: WatchlistPlayer): Promise<HTMLImageElement | null> {
  const main = getPlayerHeadshotUrl(p);
  const espn = getEspnHeadshotUrl(p.id);
  const fromMain = await loadPhoto(main);
  if (fromMain) return fromMain;
  if (espn !== main) return loadPhoto(espn);
  return null;
}

async function loadPhotos(players: WatchlistPlayer[]): Promise<PhotoMap> {
  const entries = await Promise.all(players.map(async p => [p.id, await loadPlayerPhoto(p)] as const));
  const map: PhotoMap = {};
  for (const [id, img] of entries) map[id] = img;
  return map;
}

function orderedList(players: WatchlistPlayer[], fantasyOn: boolean, data: Record<number, PlayerFantasy>) {
  return fantasyOn
    ? [...players].sort((a, b) => (data[b.id]?.value ?? -1) - (data[a.id]?.value ?? -1))
    : players;
}

// Draws the roster picture: a grid of player photos with the name and team
// under each one. Up to 6 players use 3 per row (bigger), 7-15 use 4 per row
// so a full roster stays readable on a phone screen.
function drawRoster(
  canvas: HTMLCanvasElement,
  teamName: string,
  players: WatchlistPlayer[],
  fantasyOn: boolean,
  data: Record<number, PlayerFantasy>,
  photos: PhotoMap
) {
  const primary = cssRgb('--skin-primary-rgb', '255, 107, 43');
  const secondary = cssRgb('--skin-secondary-rgb', '255, 107, 43');
  const dark = isDark(primary);
  const ink = dark ? '#ffffff' : '#111111';
  const inkSoft = dark ? 'rgba(255,255,255,0.75)' : 'rgba(17,17,17,0.72)';
  const circle = dark ? '#ffffff' : '#111111';
  const circleText = dark ? '#111111' : '#ffffff';
  const photoBg = dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.88)';

  let fontFamily = 'Arial Narrow, Arial, sans-serif';
  try {
    const f = getComputedStyle(document.body).getPropertyValue('--font-display').trim();
    if (f) fontFamily = `${f}, ${fontFamily}`;
  } catch {
    // ignore
  }

  const list = orderedList(players, fantasyOn, data);

  const cols = list.length <= 6 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const cardW = (W - MARGIN * 2 - COL_GAP * (cols - 1)) / cols;
  const photoH = Math.round(cardW * 0.82);
  const nameSize = cols === 3 ? 38 : 32;
  const teamSize = cols === 3 ? 28 : 25;
  const cardH = photoH + 14 + nameSize + 6 + teamSize + 4;
  const gridH = rows * cardH + (rows - 1) * ROW_GAP;

  const H = GRID_TOP + gridH + 140;
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
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? list.length - row * cols : cols;
    // a short last row is centred
    const rowOffset = ((cols - inRow) * (cardW + COL_GAP)) / 2;
    const x = MARGIN + rowOffset + col * (cardW + COL_GAP);
    const y = GRID_TOP + row * (cardH + ROW_GAP);
    const d = fantasyOn ? data[p.id] : undefined;
    const out = d?.status === 'out';
    const radius = 22;

    // photo box
    ctx.fillStyle = photoBg;
    roundRectPath(ctx, x, y, cardW, photoH, radius);
    ctx.fill();

    const img = photos[p.id];
    if (img && img.naturalWidth > 0) {
      ctx.save();
      roundRectPath(ctx, x, y, cardW, photoH, radius);
      ctx.clip();
      if (out) ctx.globalAlpha = 0.5;
      const scale = Math.max(cardW / img.naturalWidth, photoH / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, x + (cardW - dw) / 2, y, dw, dh);
      ctx.restore();
    } else {
      const cx = x + cardW / 2;
      const cy = y + photoH / 2;
      ctx.fillStyle = circle;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cardW, photoH) * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = circleText;
      ctx.font = `700 ${Math.round(cardW * 0.2)}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase(),
        cx,
        cy + Math.round(cardW * 0.07)
      );
      ctx.textAlign = 'left';
    }

    // fantasy badge (status if hurt, otherwise value), top-left of the photo
    if (fantasyOn && d) {
      const hurt = d.status && d.status !== 'healthy';
      const label = hurt ? STATUS_LABEL[d.status!].toUpperCase() : d.value != null ? String(d.value) : '';
      if (label) {
        ctx.font = `700 24px ${fontFamily}`;
        const bw = ctx.measureText(label).width + 22;
        ctx.fillStyle = hurt ? STATUS_COLOR[d.status!] : '#111111';
        roundRectPath(ctx, x + 10, y + 10, bw, 36, 10);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 21, y + 36);
      }
    }

    // name (first initial + last name; shrinks, then drops to last name only)
    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    const full = `${(p.first_name[0] ?? '').toUpperCase()}. ${p.last_name}`.toUpperCase();
    const lastOnly = p.last_name.toUpperCase();
    let label = full;
    let fs = nameSize;
    ctx.font = `800 ${fs}px ${fontFamily}`;
    while (ctx.measureText(label).width > cardW - 6 && fs > nameSize * 0.75) {
      fs -= 1;
      ctx.font = `800 ${fs}px ${fontFamily}`;
    }
    if (ctx.measureText(label).width > cardW - 6) {
      label = lastOnly;
      fs = nameSize;
      ctx.font = `800 ${fs}px ${fontFamily}`;
      while (ctx.measureText(label).width > cardW - 6 && fs > 18) {
        fs -= 1;
        ctx.font = `800 ${fs}px ${fontFamily}`;
      }
    }
    ctx.fillText(label, x + cardW / 2, y + photoH + 14 + nameSize - 4);

    ctx.fillStyle = inkSoft;
    ctx.font = `500 ${teamSize}px ${fontFamily}`;
    ctx.fillText(
      `${p.team_abbreviation}${p.position ? ' · ' + p.position : ''}`,
      x + cardW / 2,
      y + photoH + 14 + nameSize + 6 + teamSize - 4
    );
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
  const [canShareLink, setCanShareLink] = useState(false);
  const [linkText, setLinkText] = useState(''); // shown only if the browser won't copy for us
  const [addingPhotos, setAddingPhotos] = useState(true);
  const readyRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    // 1) draw straight away with initials, so something shows immediately
    drawRoster(canvas, teamName, players, fantasyOn, data, {});
    try {
      setPreview(canvas.toDataURL('image/png'));
    } catch {
      setMessage("Couldn't make the picture in this browser.");
    }

    // 2) fetch the photos, then draw again with them
    readyRef.current = (async () => {
      const photos = await loadPhotos(players);
      if (cancelled) return;
      const loaded = players.filter(p => photos[p.id]).length;
      drawRoster(canvas, teamName, players, fantasyOn, data, photos);
      try {
        setPreview(canvas.toDataURL('image/png'));
        if (players.length > 0 && loaded === 0) {
          setMessage("The photos couldn't be added here, so initials are shown.");
        }
      } catch {
        // photos made the picture unsaveable: go back to initials-only
        drawRoster(canvas, teamName, players, fantasyOn, data, {});
        try {
          setPreview(canvas.toDataURL('image/png'));
        } catch {
          setMessage("Couldn't make the picture in this browser.");
        }
      }
      setAddingPhotos(false);
    })();

    try {
      const probe = new File([''], 'x.png', { type: 'image/png' });
      setCanShare(!!navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShare(false);
    }
    setCanShareLink(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', esc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // waits for the photos first, so a saved/shared picture always has them
  const toBlob = async () => {
    await readyRef.current;
    return new Promise<Blob | null>(resolve => {
      const c = canvasRef.current;
      if (!c) return resolve(null);
      try {
        c.toBlob(b => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });
  };

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

  const handleCopyLink = async () => {
    const url = buildShareUrl(teamName, players);
    try {
      await navigator.clipboard.writeText(url);
      setLinkText('');
      setMessage('Link copied. Anyone who opens it can add this team to their own Courtside.');
    } catch {
      setLinkText(url);
      setMessage('Copy the link below.');
    }
  };

  const handleShareLink = async () => {
    try {
      await navigator.share({ title: teamName, text: `${teamName} on Courtside`, url: buildShareUrl(teamName, players) });
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
          <button onClick={handleCopyLink} className={btn} style={{ background: '#000', color: '#fff' }}>
            Copy link
          </button>
          {canShareLink && (
            <button
              onClick={handleShareLink}
              className={btn}
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Share link
            </button>
          )}
          {canShare && (
            <button
              onClick={handleShare}
              className={btn}
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Share image
            </button>
          )}
          <button
            onClick={handleDownload}
            className={btn}
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
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
        {linkText && (
          <input
            readOnly
            value={linkText}
            onFocus={e => e.currentTarget.select()}
            aria-label="Share link"
            className="w-full mt-3 px-3 py-2 rounded-lg font-mono text-[11px]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        )}
        <p className="font-body text-xs text-center mt-2 min-h-[16px]" style={{ color: 'var(--color-text-secondary)' }}>
          {preview ? (addingPhotos ? 'Adding photos…' : message) : ''}
        </p>
      </div>
    </div>
  );
}
