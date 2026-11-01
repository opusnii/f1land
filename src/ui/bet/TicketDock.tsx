/* Sticky ticket dock for the pool screen: pick, stake presets, potential return and the swipe-to-confirm CTA (spec §6). */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { fmtCountdown, fmtNumber, t } from '@/i18n/core';
import { IconCheck, IconChevron, IconClose, IconLock, IconTarget } from '@/ui/icons';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { prefersReducedMotion, useSettings } from '@/store/settings';
import { IcCoins, IcMinus, IcPlus } from './icons';
import { CountUp, OddsTicker } from './motionBits';

export const MIN_STAKE = 10;
export const MAX_STAKE = 5000;
/** Lock countdown turns amber at this point (red heartbeat at 10 s lives in the header timer). */
export const URGENT_MS = 30_000;
const CHIPS = [10, 25, 50, 100] as const;

export interface DockPick {
  label: string;
  icon: ReactNode;
  odds: number;
  /** Share of the DEMO pool already on this outcome (0..1), null when the book is empty. */
  share: number | null;
}

export interface TicketDockProps {
  locked: boolean;
  pick: DockPick | null;
  stake: number;
  onStake: (v: number) => void;
  balance: number;
  msLeft: number;
  totalMs: number;
  ctaLabel: string;
  ctaSub?: string;
  canConfirm: boolean;
  /** Why the CTA is disabled (shown under it). */
  reason?: string;
  onConfirm: () => void;
  onClear: () => void;
  lockedText: string;
}

const stepOf = (v: number) => (v >= 500 ? 50 : v >= 100 ? 25 : 5);

export function TicketDock({ locked, pick, stake, onStake, balance, msLeft, totalMs, ctaLabel, ctaSub, canConfirm, reason, onConfirm, onClear, lockedText }: TicketDockProps) {
  const reduced = prefersReducedMotion(useSettings((s) => s.motion));
  const urgent = !locked && msLeft <= URGENT_MS;
  const frac = locked ? 0 : Math.max(0, Math.min(1, totalMs > 0 ? msLeft / totalMs : 0));
  const open = !locked && pick !== null;
  const ret = pick ? Math.round(stake * pick.odds) : 0;

  // One gentle nudge when a held pick enters the last 10 seconds.
  const nudged = useRef(false);
  useEffect(() => {
    if (!pick || locked) {
      nudged.current = false;
      return;
    }
    if (msLeft <= 10_000 && msLeft > 0 && !nudged.current) {
      nudged.current = true;
      haptic.impact('light');
    }
  }, [msLeft, pick, locked]);

  return (
    <section className={`tdock ${open ? '' : 'tdock--slim'} ${urgent ? 'tdock--urgent' : ''} ${locked ? 'tdock--locked' : ''}`} aria-label={t('pool2.ticket')}>
      <div className="tdock__timer" aria-hidden="true">
        <span style={{ transform: `scaleX(${frac})` }} />
      </div>

      <div className="tdock__top">
        {urgent ? (
          <span className="tdock__k tdock__k--urgent" role="timer" aria-live="off">
            {t('pool2.closing')} <b className="num">{fmtCountdown(msLeft)}</b>
          </span>
        ) : (
          <span className="tdock__k">
            <span className="techlabel">{locked ? t('pool2.headerLocked') : t('pool2.ticket')}</span>
            {open && <span className="tdock__count">{t('pl.onePick')}</span>}
            <span className="tdock__demo">DEMO</span>
          </span>
        )}
        <span className="tdock__bal num">
          <IcCoins size={13} /> <b>{fmtNumber(Math.floor(balance))}</b>
        </span>
      </div>

      {locked ? (
        <div className="tdock__locked" role="status">
          <span className="tdock__lock-ico" aria-hidden="true">
            <IconLock size={15} />
          </span>
          <span>{lockedText}</span>
        </div>
      ) : pick ? (
        <div className="tdock__row">
          <div className="tdock__pick">
            <span className="tdock__pick-ico" aria-hidden="true">
              {pick.icon}
            </span>
            <span className="tdock__pick-t">
              <b>{pick.label}</b>
              <small>{pick.share && pick.share > 0 ? t('pool2.share', { p: Math.max(1, Math.round(pick.share * 100)) }) : t('pool2.firstBacker')}</small>
            </span>
            <OddsTicker odds={pick.odds} className="tdock__odds" />
            <button
              type="button"
              className="tdock__clear"
              aria-label={t('pool2.clear')}
              onClick={() => {
                sfx.tap();
                onClear();
              }}
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="tdock__prompt">
          <span className="tdock__prompt-ico" aria-hidden="true">
            <IconTarget size={15} />
          </span>
          <span className="tdock__prompt-t">{t('pool2.prompt')}</span>
          <span className="tdock__prompt-stake num">
            {t('pool2.stake')} <b>{fmtNumber(stake)}</b>
          </span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {(open || locked) && (
          <motion.div
            key="more"
            className="tdock__more"
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {open && (
              <div className="tdock__stake-row">
                <StakeRow stake={stake} onStake={onStake} balance={balance} />
                <div className="tdock__ret" aria-live="polite">
                  <small className="techlabel">{t('pv2.returnK')}</small>
                  <b className="num">
                    ≈ <CountUp value={ret} duration={reduced ? 0 : 420} />
                  </b>
                  <em>PULSE</em>
                </div>
              </div>
            )}
            <div className="tdock__cta">
              <SwipeCta label={ctaLabel} sub={ctaSub} disabled={!canConfirm} locked={locked} onConfirm={onConfirm} reduced={reduced} />
              {(locked || reason) && <p className="tdock__reason">{locked ? t('pv2.lockedReason') : reason}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stake: stepper + preset chips                                       */
/* ------------------------------------------------------------------ */

function StakeRow({ stake, onStake, balance }: { stake: number; onStake: (v: number) => void; balance: number }) {
  const cap = Math.max(MIN_STAKE, Math.min(MAX_STAKE, Math.floor(balance)));
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.max(MIN_STAKE, Math.min(cap, Math.round(v)));
  const set = (v: number) => {
    const n = clamp(v);
    if (n !== stake) {
      haptic.tap();
      sfx.tick();
    }
    onStake(n);
  };
  const step = stepOf(stake);

  return (
    <div className="tdock__stake">
      <div className="tdock__step">
        <button type="button" className="tdock__sbtn" aria-label={t('pool2.decrease')} disabled={stake <= MIN_STAKE} onClick={() => set(stake - step)}>
          <IcMinus size={16} />
        </button>
        <label className="tdock__val">
          <input
            className="num"
            inputMode="numeric"
            enterKeyHint="done"
            aria-label={t('pool2.stake')}
            value={draft ?? String(stake)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
            onBlur={() => {
              if (draft !== null) set(Number(draft) || MIN_STAKE);
              setDraft(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
        <button type="button" className="tdock__sbtn" aria-label={t('pool2.increase')} disabled={stake >= cap} onClick={() => set(stake + step)}>
          <IcPlus size={16} />
        </button>
      </div>
      <div className="tdock__chips" role="group" aria-label={t('pool2.stake')}>
        {CHIPS.map((c) => (
          <button type="button" key={c} className={`tdock__chip num ${stake === c ? 'tdock__chip--on' : ''}`} aria-pressed={stake === c} disabled={c > balance} onClick={() => set(c)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Swipe-to-confirm                                                    */
/* ------------------------------------------------------------------ */

const KNOB = 48;
const PAD = 4;
const COMMIT = 0.85;
const NUDGE_EVERY = 4000;
const NUDGES = 3;

/**
 * Deliberate commit gesture: the fill follows the finger and clicks (medium haptic) past 85 %.
 * Enter / Space confirm for keyboard and assistive tech. Inert the instant it is disabled, even mid-drag (QA17).
 */
function SwipeCta({ label, sub, disabled, locked, onConfirm, reduced }: { label: string; sub?: string; disabled: boolean; locked: boolean; onConfirm: () => void; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; max: number; id: number; armed: boolean } | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(0);

  useLayoutEffect(() => {
    if (disabled) {
      drag.current = null;
      setDragging(false);
      setX(0);
    }
  }, [disabled]);

  // Chevron hint every 4 s, three times, then rest (spec §6: never loop forever).
  useEffect(() => {
    if (disabled || reduced) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setNudge(n);
      if (n >= NUDGES) window.clearInterval(id);
    }, NUDGE_EVERY);
    return () => window.clearInterval(id);
  }, [disabled, reduced]);

  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => {
      setDone(false);
      setX(0);
    }, 1100);
    return () => window.clearTimeout(id);
  }, [done]);

  const maxOf = () => Math.max(0, (ref.current?.clientWidth ?? 0) - KNOB - PAD * 2);

  const commit = () => {
    if (disabled || done) return;
    setX(maxOf());
    setDone(true);
    onConfirm();
  };

  const release = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (!disabled && x >= d.max * COMMIT) commit();
    else {
      if (x > 8) haptic.impact('soft');
      setX(0);
    }
  };

  const m = maxOf();
  const progress = done ? 1 : m > 0 ? x / m : 0;

  return (
    <div
      ref={ref}
      className={`sw ${dragging ? 'sw--drag' : ''} ${disabled ? 'sw--off' : x === 0 && !done ? 'sw--armed' : ''} ${done ? 'sw--done' : ''} ${locked ? 'sw--locked' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`${label}${sub ? `. ${sub}` : ''}${disabled ? '' : `. ${t('pool2.swipeAria')}`}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          commit();
        }
      }}
      onPointerDown={(e) => {
        if (disabled || done) return;
        drag.current = { x0: e.clientX - x, max: maxOf(), id: e.pointerId, armed: false };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        haptic.impact('light');
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        if (disabled) {
          release();
          return;
        }
        const nx = Math.max(0, Math.min(d.max, e.clientX - d.x0));
        const past = nx >= d.max * COMMIT;
        if (past !== d.armed) {
          d.armed = past;
          if (past) haptic.impact('medium');
        }
        setX(nx);
      }}
      onPointerUp={release}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
        setX(0);
      }}
      style={{ ['--sw-p' as string]: progress.toFixed(3) } as CSSProperties}
    >
      <span className="sw__fill" style={{ width: done ? '100%' : x > 0 ? x + KNOB + PAD * 2 : 0 }} aria-hidden="true" />
      <span className="sw__label" style={{ opacity: done ? 1 : 1 - Math.min(0.8, progress * 1.15) }}>
        <b>{done ? t('pv2.accepted') : label}</b>
        {sub && !done && <small>{sub}</small>}
      </span>
      {!disabled && !done && (
        <span key={nudge} className={`sw__chev ${nudge > 0 ? 'sw__chev--nudge' : ''}`} aria-hidden="true" style={{ opacity: 1 - progress }}>
          <IconChevron size={16} />
          <IconChevron size={16} />
        </span>
      )}
      <span className="sw__knob" style={{ transform: x ? `translate3d(${x}px, 0, 0)` : undefined, transition: dragging ? 'none' : `transform ${reduced ? 0 : 0.32}s var(--ease-out)` }} aria-hidden="true">
        {done ? <IconCheck size={22} /> : locked ? <IconLock size={18} /> : <IconChevron size={22} />}
      </span>
    </div>
  );
}
