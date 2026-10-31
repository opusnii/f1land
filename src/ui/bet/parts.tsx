/* Prediction UI building blocks: countdown ring, outcome tiles, confetti, stat cells, pool meta. */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { fmtNumber, t } from '@/i18n/core';
import { useSettings, prefersReducedMotion } from '@/store/settings';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { LockTimer } from '@/ui/LockTimer';
import { IconLock } from '@/ui/icons';
import { IcCoins, IcTrophy, IcYes } from './icons';
import { OddsTicker } from './motionBits';
import '@/styles/pool.css';

export { EventTimeline, GapMeter, SectorGlyph, StintBar } from './viz';

/* ------------------------------------------------------------------ */
/* Countdown ring                                                      */
/* ------------------------------------------------------------------ */

/**
 * Kept for existing callers (live pool panel). One timer logic for every pool surface:
 * a thin wrapper over `<LockTimer variant="ring">`, which supplies its own accessible label.
 */
export function CountdownRing({ ms, totalMs, size = 44, locked }: { ms: number; totalMs: number; size?: number; locked?: boolean; label?: string }) {
  return <LockTimer variant="ring" ms={ms} totalMs={totalMs} size={size} accept={!locked} status={locked ? 'LOCKED' : 'OPEN'} />;
}

/* ------------------------------------------------------------------ */
/* Outcome tile (S2 → S2-sel)                                          */
/* ------------------------------------------------------------------ */

export type TileVariant = 'tile' | 'driver' | 'row' | 'num' | 'zone' | 'wide';

export interface OutcomeTileProps {
  variant?: TileVariant;
  label: ReactNode;
  sub?: ReactNode;
  /** Object or mini-visual (tyre, flag, helmet, sector outline, big glyph). */
  icon?: ReactNode;
  odds: number | null;
  checked: boolean;
  disabled?: boolean;
  /** Settled state: winner/loser, and whether it was the user's pick. */
  result?: 'win' | 'lose' | null;
  mine?: boolean;
  color?: string;
  /** Share of the DEMO pool already on this outcome (0..1). */
  share?: number | null;
  /** Intake closed (not yet settled): lock overlay + desaturation. */
  locked?: boolean;
  ariaLabel?: string;
  onSelect: () => void;
}

export function OutcomeTile({ variant = 'tile', label, sub, icon, odds, checked, disabled, result, mine, color, share, locked, ariaLabel, onSelect }: OutcomeTileProps) {
  const cls = ['ot', 'tile', `ot--${variant}`, checked && 'ot--on', disabled && 'ot--off', result && `ot--${result}`, mine && 'ot--mine', locked && !result && 'ot--locked'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      className={cls}
      style={color ? ({ ['--ot-c' as string]: color } as CSSProperties) : undefined}
      onClick={() => {
        if (disabled) {
          haptic.notify('warning');
          return;
        }
        if (!checked) {
          haptic.impact('light');
          sfx.select();
        }
        onSelect();
      }}
    >
      {checked && !result && (
        <span className="ot__check" aria-hidden="true">
          <IcYes size={11} />
        </span>
      )}
      {result === 'win' && (
        <span className="ot__trophy" aria-hidden="true">
          <IcTrophy size={13} />
        </span>
      )}
      {icon && (
        <span className="ot__vis" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="ot__text">
        <span className="ot__label">{label}</span>
        {sub && <span className="ot__sub">{sub}</span>}
      </span>
      <OddsTicker odds={odds} className="ot__odds" />
      {mine && <span className="ot__mine">{t('pl.yourPick')}</span>}
      {share !== undefined && share !== null && share > 0 && (
        <span className="ot__share" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, share)})` }} />
        </span>
      )}
      {locked && !result && (
        <span className="ot__lock" aria-hidden="true">
          <IconLock size={14} />
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Confetti (canvas burst, reduced-motion aware)                       */
/* ------------------------------------------------------------------ */

const CONFETTI_COLORS = ['#c6ff3d', '#2fe6ff', '#ffffff', '#ffd12e', '#b26bff'];

export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const motion = useSettings((s) => s.motion);
  useEffect(() => {
    if (!fire || !ref.current) return;
    const reduced = prefersReducedMotion(motion);
    const cv = ref.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = (cv.width = cv.clientWidth * dpr);
    const h = (cv.height = cv.clientHeight * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const n = reduced ? 36 : 150;
    const parts = Array.from({ length: n }, (_, i) => {
      const left = i % 2 === 0;
      return {
        x: w * (left ? 0.12 : 0.88),
        y: h * 0.64,
        vx: (left ? 1 : -1) * (1.5 + Math.random() * 7) * dpr,
        vy: -(11 + Math.random() * 10) * dpr,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        s: (5 + Math.random() * 6) * dpr,
        c: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      };
    });
    let raf = 0;
    const t0 = performance.now();
    const dur = reduced ? 900 : 2600;
    const step = (now: number) => {
      const k = (now - t0) / dur;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        if (!reduced) {
          p.vy += 0.32 * dpr;
          p.vx *= 0.99;
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fire, motion]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function StatCell({ k, v, sub, accent }: { k: ReactNode; v: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="stat">
      <span className="stat__k">{k}</span>
      <span className="stat__v num" style={accent ? { color: accent } : undefined}>
        {v}
      </span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
}

/** Pool size / participants line. */
export function PoolMeta({ total, players }: { total: number; players: number }) {
  return (
    <span className="pmeta num">
      <IcCoins size={13} /> {fmtNumber(total)}
      <span className="pmeta__sep" />
      {t('pool.participants', { n: fmtNumber(players) })}
    </span>
  );
}
