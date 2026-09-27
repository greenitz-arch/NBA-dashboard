'use client';

import { useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// "Mr. Linea" — entrance animation for the empty-roster hero.
//
// Plays once per page load whenever the roster is empty — it does not
// loop, but it does replay on every fresh load/reload of an empty roster
// (no "seen it once, ever" memory). EmptyState.tsx only mounts this
// component when !hasPlayers, so it never shows once a player exists.
//
// The whole figure is drawn procedurally every frame (legs via simple
// two-bone IK so a foot is always exactly planted on the trail line, ball
// bounce, dribbling arm, back-arm counter-swing) rather than as a few fixed
// poses — confirmed in the chat demo before this was written. See that
// demo's storyboard history for why the numbers below are what they are
// (e.g. the twirl spins the whole figure rather than showing a static pose
// with an icon, the jump freezes the trail while airborne, etc.).
// ─────────────────────────────────────────────────────────────────────────

type Segment = {
  name: string;
  dur: number;
  fromX: number;
  toX: number;
  mode: 'walk' | 'twirl' | 'jump';
  side?: 'R' | 'L';
  fade?: boolean;
};

const SEGMENTS: Segment[] = [
  { name: 'enter',      dur: 900,  fromX: -60,  toX: 140, mode: 'walk',  side: 'R' },
  { name: 'dribble1',   dur: 700,  fromX: 140,  toX: 230, mode: 'walk',  side: 'R' },
  { name: 'crossover1', dur: 500,  fromX: 230,  toX: 300, mode: 'walk',  side: 'L' },
  { name: 'dribble2',   dur: 700,  fromX: 300,  toX: 380, mode: 'walk',  side: 'R' },
  { name: 'crossover2', dur: 500,  fromX: 380,  toX: 440, mode: 'walk',  side: 'L' },
  { name: 'dribble3',   dur: 600,  fromX: 440,  toX: 500, mode: 'walk',  side: 'R' },
  { name: 'twirl',      dur: 900,  fromX: 500,  toX: 500, mode: 'twirl' },
  { name: 'jump',       dur: 800,  fromX: 500,  toX: 580, mode: 'jump' },
  { name: 'continue',   dur: 700,  fromX: 580,  toX: 650, mode: 'walk',  side: 'R' },
  { name: 'crossover3', dur: 450,  fromX: 650,  toX: 710, mode: 'walk',  side: 'L' },
  { name: 'exit',       dur: 1000, fromX: 710,  toX: 900, mode: 'walk',  side: 'R', fade: true },
];

const BASE_TY = 26;
const JUMP_LIFT = 70;
const BOB_AMP = 6;
const SPIN_TURNS = 2.25;
const SCALE = 0.85;
const CANVAS_W = 1000;
const WALK_RATE = 0.0072;

const HIP = { x: 100, y: 130 };
const SHOULDER = { x: 100, y: 85 };
const THIGH = 42, SHIN = 50, ARM1 = 35, ARM2 = 40;
const FRONT_X = HIP.x + 40, BACK_X = HIP.x - 40, GROUND_Y = 205, LIFT = 32;
const PIVOT = { x: 100, y: 138 };

const starts: number[] = [];
(() => { let t = 0; for (const s of SEGMENTS) { starts.push(t); t += s.dur; } })();
const TOTAL = starts[starts.length - 1] + SEGMENTS[SEGMENTS.length - 1].dur;

function lerp(a: number, b: number, p: number) { return a + (b - a) * p; }
function pt(base: { x: number; y: number }, len: number, ang: number) {
  return { x: base.x + len * Math.sin(ang), y: base.y + len * Math.cos(ang) };
}
function P(p: { x: number; y: number }) { return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }

export default function MrLineaAnimation() {
  const svgRef = useRef<SVGSVGElement>(null);
  const trailRef = useRef<SVGLineElement>(null);
  const figureRef = useRef<SVGGElement>(null);
  const legARef = useRef<SVGPathElement>(null);
  const legBRef = useRef<SVGPathElement>(null);
  const armBackRef = useRef<SVGPathElement>(null);
  const armBallRef = useRef<SVGPathElement>(null);
  const ballRef = useRef<SVGCircleElement>(null);
  const seam1Ref = useRef<SVGPathElement>(null);
  const seam2Ref = useRef<SVGPathElement>(null);
  const seam3Ref = useRef<SVGPathElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trail = trailRef.current, figure = figureRef.current;
    const legA = legARef.current, legB = legBRef.current;
    const armBack = armBackRef.current, armBall = armBallRef.current;
    const ball = ballRef.current, seam1 = seam1Ref.current, seam2 = seam2Ref.current, seam3 = seam3Ref.current;
    if (!trail || !figure || !legA || !legB || !armBack || !armBall || !ball || !seam1 || !seam2 || !seam3) return;

    let rafId = 0, lastIdx = -1, frozenTrailX = 0, walkPhase = 0, lastNow = 0, groundContactX = -1000;

    function setBall(cx: number, cy: number) {
      ball!.setAttribute('cx', String(cx)); ball!.setAttribute('cy', String(cy));
      seam1!.setAttribute('d', `M${cx - 12} ${cy} L${cx + 12} ${cy}`);
      seam2!.setAttribute('d', `M${cx} ${cy - 12} Q${cx - 8} ${cy} ${cx} ${cy + 12}`);
      seam3!.setAttribute('d', `M${cx} ${cy - 12} Q${cx + 8} ${cy} ${cx} ${cy + 12}`);
    }

    function ikLeg(footX: number, footY: number) {
      const dx = footX - HIP.x, dy = footY - HIP.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      const maxD = THIGH + SHIN - 0.5, minD = Math.abs(THIGH - SHIN) + 0.5;
      dist = Math.min(Math.max(dist, minD), maxD);
      const a = Math.atan2(dx, dy);
      const cosAngle = (THIGH * THIGH + dist * dist - SHIN * SHIN) / (2 * THIGH * dist);
      const angOffset = Math.acos(Math.min(1, Math.max(-1, cosAngle)));
      const kneeAngle = a + angOffset;
      const knee = pt(HIP, THIGH, kneeAngle);
      return { knee, foot: { x: footX, y: footY } };
    }

    function legFoot(phase: number) {
      const u = (((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
      if (u < 0.5) {
        const u2 = u / 0.5;
        return { x: lerp(FRONT_X, BACK_X, u2), y: GROUND_Y };
      }
      const u2 = (u - 0.5) / 0.5;
      return { x: lerp(BACK_X, FRONT_X, u2), y: GROUND_Y - LIFT * Math.sin(u2 * Math.PI) };
    }

    function poseWalk(side: 'R' | 'L', x: number) {
      const footA = legFoot(walkPhase), footB = legFoot(walkPhase + Math.PI);
      const ikA = ikLeg(footA.x, footA.y), ikB = ikLeg(footB.x, footB.y);
      legA!.setAttribute('d', `M${P(HIP)} L${P(ikA.knee)} L${P(ikA.foot)}`);
      legB!.setAttribute('d', `M${P(HIP)} L${P(ikB.knee)} L${P(ikB.foot)}`);

      const stanceLocalX = footA.y === GROUND_Y ? footA.x : footB.x;
      groundContactX = Math.max(groundContactX, x + stanceLocalX * SCALE);

      const armAngle = -0.4 * Math.sin(walkPhase);
      const elbowBack = pt(SHOULDER, ARM1, armAngle), handBack = pt(elbowBack, ARM2, armAngle);
      armBack!.setAttribute('d', `M${P(SHOULDER)} L${P(elbowBack)} L${P(handBack)}`);

      const ballPhase = walkPhase * 2;
      const bx = side === 'R' ? 153 : 47;
      const by = 192 - 42 * Math.abs(Math.sin(ballPhase));
      setBall(bx, by);
      const dx = side === 'R' ? 12 : -12;
      const elbowBall = { x: (SHOULDER.x + bx) / 2 + dx, y: (SHOULDER.y + by) / 2 - 5 };
      armBall!.setAttribute('d', `M${P(SHOULDER)} L${P(elbowBall)} L${bx.toFixed(1)} ${by.toFixed(1)}`);

      return BOB_AMP * Math.abs(Math.sin(walkPhase * 2));
    }

    function poseTwirl() {
      legA!.setAttribute('d', `M${P(HIP)} L96 170 L92 205`);
      legB!.setAttribute('d', `M${P(HIP)} L104 170 L108 205`);
      armBack!.setAttribute('d', `M${P(SHOULDER)} L82 112 L92 122`);
      armBall!.setAttribute('d', `M${P(SHOULDER)} L118 112 L108 122`);
      setBall(100, 122);
      return 0;
    }

    function poseJump(progress: number) {
      const tuck = 1.1 * Math.sin(progress * Math.PI);
      const kneeA = pt(HIP, THIGH, -0.3 - tuck * 0.3), kneeB = pt(HIP, THIGH, 0.3 + tuck * 0.3);
      legA!.setAttribute('d', `M${P(HIP)} L${P(kneeA)} L${P(pt(kneeA, SHIN, -0.3 + tuck * 1.1))}`);
      legB!.setAttribute('d', `M${P(HIP)} L${P(kneeB)} L${P(pt(kneeB, SHIN, 0.3 - tuck * 1.1))}`);
      armBack!.setAttribute('d', `M${P(SHOULDER)} L70 55 L60 35`);
      armBall!.setAttribute('d', `M${P(SHOULDER)} L128 55 L138 35`);
      setBall(100, 30);
      return 0;
    }

    function render(elapsed: number, dt: number) {
      let idx = SEGMENTS.length - 1;
      for (let i = 0; i < SEGMENTS.length; i++) {
        if (elapsed < starts[i] + SEGMENTS[i].dur) { idx = i; break; }
      }
      const seg = SEGMENTS[idx];
      if (idx !== lastIdx && seg.mode === 'jump') frozenTrailX = groundContactX;
      lastIdx = idx;

      const segElapsed = Math.min(Math.max(elapsed - starts[idx], 0), seg.dur);
      const p = seg.dur === 0 ? 1 : segElapsed / seg.dur;
      const x = lerp(seg.fromX, seg.toX, p);
      let ty = BASE_TY;
      if (seg.mode === 'jump') ty = BASE_TY - JUMP_LIFT * Math.sin(p * Math.PI);

      walkPhase += WALK_RATE * dt;

      let bob = 0;
      if (seg.mode === 'walk') bob = poseWalk(seg.side as 'R' | 'L', x);
      else if (seg.mode === 'twirl') poseTwirl();
      else if (seg.mode === 'jump') poseJump(p);

      let transform = `translate(${x},${ty - bob}) scale(${SCALE})`;
      if (seg.mode === 'twirl') transform += ` rotate(${(p * 360 * SPIN_TURNS).toFixed(1)},${PIVOT.x},${PIVOT.y})`;
      figure!.setAttribute('transform', transform);
      figure!.style.opacity = seg.fade ? String(1 - p) : '1';

      trail!.setAttribute('x2', String(Math.max(0, seg.mode === 'jump' ? frozenTrailX : groundContactX)));
    }

    function tick(now: number) {
      const elapsed = now - tickStart;
      const dt = lastNow ? now - lastNow : 16;
      lastNow = now;
      if (elapsed >= TOTAL) {
        render(TOTAL, dt);
        trail!.setAttribute('x2', String(CANVAS_W));
        figure!.style.opacity = '0';
        return;
      }
      render(elapsed, dt);
      rafId = requestAnimationFrame(tick);
    }

    const tickStart = performance.now();
    rafId = requestAnimationFrame(tick);

    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, []);

  return (
    <div ref={rootRef} className="mt-4 mb-2" aria-hidden="true">
      <svg ref={svgRef} viewBox="0 0 1000 240" className="w-full h-auto" style={{ maxHeight: 220 }}>
        <line ref={trailRef} x1="0" y1="200" x2="0" y2="200" stroke="#fff" strokeWidth="9" />
        <g ref={figureRef}>
          <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="100" cy="55" r="14" strokeWidth="9" />
            <line x1="100" y1="70" x2="100" y2="130" />
            <path ref={legARef} />
            <path ref={legBRef} />
            <path ref={armBackRef} />
            <path ref={armBallRef} />
          </g>
          <g>
            <circle ref={ballRef} r="12" fill="var(--neon-orange)" />
            <path ref={seam1Ref} stroke="#000" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            <path ref={seam2Ref} stroke="#000" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            <path ref={seam3Ref} stroke="#000" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}
