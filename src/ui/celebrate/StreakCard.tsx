import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { STREAK_BONUS, dayKey, useRewards, useStreak } from '@/store/rewards';
import { useNav } from '@/store/nav';
import { useNow } from '@/ui/kit';
import { Obj } from '@/ui/Obj';
import { fmtCountdown, fmtDuration, fmtNumber, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { useReduced } from '@/screens/common';
import { IconCheck, IconGift, IconStar, IconTimer, IconTrophy } from '@/ui/icons';
import { streakTrack } from './streak';
import { CoinLayer, flyCoins, headerBalanceEl } from './coins';
import './celebrate.css';

const msToMidnight = (ms: number) => {
  const d = new Date(ms);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - ms;
};

/** Wall-clock "now" that refreshes exactly at local midnight and when the app returns from the background. */
function useToday(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), msToMidnight(now) + 60);
    return () => window.clearTimeout(id);
  }, [now]);
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, []);
  return now;
}

/** Time to the next local midnight; `long` ticks every second as h:mm:ss. */
function NextIn({ long }: { long?: boolean }) {
  const now = useNow(long ? 1000 : 30_000);
  const ms = msToMidnight(now);
  return <span className="num">{long ? fmtCountdown(ms) : fmtDuration(ms)}</span>;
}

/* ------------------------------------------------------------------ */
/* Claim logic shared by both variants                                  */
/* ------------------------------------------------------------------ */

interface Float {
  key: number;
  bonus: number;
  at: { x: number; y: number };
}

/** Centre of `el` in the coordinate space of `host`. */
function centre(el: Element | null, host: Element): { x: number; y: number } {
  const h = host.getBoundingClientRect();
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top } : { x: h.width / 2, y: h.height / 2 };
}

/** Check-in: coins fly from the button to the header balance chip (or to `fallback` when the screen has none). */
function useClaim(host: RefObject<HTMLElement | null>, origin: RefObject<HTMLElement | null>, fallback: RefObject<HTMLElement | null>) {
  const reduced = useReduced();
  const [float, setFloat] = useState<Float | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const claim = useCallback(() => {
    if (useRewards.getState().lastCheckIn === dayKey(Date.now())) return;
    // Measured first: the claim button unmounts as soon as the store updates.
    const at = host.current ? centre(origin.current, host.current) : null;
    flyCoins(origin.current, { to: headerBalanceEl() ?? fallback.current, reduced });
    const r = useRewards.getState().checkIn();
    if (!r.ok) return;
    haptic.notify('success');
    sfx.checkIn();
    setFloat({ key: Date.now(), bonus: r.bonus, at: at ?? { x: 0, y: 0 } });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFloat(null), 1700);
  }, [reduced, host, origin, fallback]);

  return { claim, float, reduced };
}

/* ------------------------------------------------------------------ */
/* Public component                                                     */
/* ------------------------------------------------------------------ */

export function StreakCard({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  return variant === 'compact' ? <StreakCompact /> : <StreakFull />;
}

function Flame({ cold, pop, size, innerRef }: { cold: boolean; pop: number; size: number; innerRef?: RefObject<HTMLSpanElement | null> }) {
  return (
    <span ref={innerRef} key={pop} className="stk__flame" data-cold={cold || undefined} data-pop={pop ? '' : undefined} aria-hidden="true">
      <Obj name="flame" size={size} />
    </span>
  );
}

function StreakFull() {
  const now = useToday();
  const view = useStreak(now);
  const host = useRef<HTMLElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const flame = useRef<HTMLSpanElement>(null);
  const { claim, float, reduced } = useClaim(host, cta, flame);

  const cold = view.count === 0 && !view.checkedToday;
  const { today, days } = streakTrack(view);
  const headline = view.count > 0 ? t('streak.day', { n: view.count }) : t('streak.start');
  const justClaimed = float ? today : 0;
  const next = t('streak.next', { t: '\u0000' }).split('\u0000');

  return (
    <section ref={host} className="card stk stk--full" aria-label={t('streak.title')} data-ready={!view.checkedToday || undefined}>
      <header className="stk__head">
        <Flame cold={cold} pop={float?.key ?? 0} size={48} innerRef={flame} />
        <div className="stk__txt">
          <h2 className="stk__h">{headline}</h2>
          <span className="stk__sub">{view.checkedToday ? t('streak.done') : t('streak.ready')}</span>
        </div>
        {view.best > 0 && (
          <span className="stk__best num">
            <IconTrophy size={12} />
            {t('streak.best', { n: view.best })}
          </span>
        )}
      </header>

      <ol className="stk__days">
        {STREAK_BONUS.map((bonus, i) => {
          const n = i + 1;
          const state = days[i]!;
          return (
            <li
              key={n}
              className="stk__day"
              data-state={state}
              data-last={n === STREAK_BONUS.length || undefined}
              data-today={n === today || undefined}
              data-just={n === justClaimed || undefined}
              aria-label={t('streak.pill', { n, b: bonus, s: t(`streak.pill.${state}`) })}
            >
              <span className="stk__dn num" aria-hidden="true">
                {state === 'done' ? <IconCheck size={13} /> : n === STREAK_BONUS.length ? <IconStar size={12} /> : n}
              </span>
              <span className="stk__db num" aria-hidden="true">
                +{bonus}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="stk__foot">
        {view.checkedToday ? (
          <div className="stk__cta stk__cta--done" role="status">
            <span className="stk__ctat">
              <IconCheck size={15} />
              {t('streak.wait')}
            </span>
            <span className="stk__ctas">
              <IconTimer size={12} />
              {next[0]}
              <NextIn long />
              {next[1]}
            </span>
          </div>
        ) : (
          <button ref={cta} className="btn btn--primary btn--block stk__cta" onClick={claim}>
            <IconGift size={18} />
            {t('streak.claim', { n: view.nextBonus })}
          </button>
        )}
      </div>
      <p className="stk__fine">{t('streak.fine')}</p>

      <span className="sr-only" role="status">
        {float ? t('streak.added', { n: fmtNumber(float.bonus) }) : ''}
      </span>
      <div className="stk__fx" aria-hidden="true">
        <AnimatePresence>
          {float && !reduced && (
            <span key={float.key} className="stk__floatwrap" style={{ left: float.at.x, top: float.at.y }}>
              <motion.span className="stk__float num" initial={{ opacity: 0, y: 12 }} animate={{ opacity: [0, 1, 1, 0], y: -30 }} transition={{ duration: 1.1, times: [0, 0.2, 0.7, 1] }}>
                +{fmtNumber(float.bonus)}
              </motion.span>
            </span>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function StreakCompact() {
  const now = useToday();
  const view = useStreak(now);
  const host = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const flame = useRef<HTMLSpanElement>(null);
  const { claim, float } = useClaim(host, chip, flame);

  const cold = view.count === 0 && !view.checkedToday;
  const headline = view.count > 0 ? t('streak.day', { n: view.count }) : t('streak.start');
  const sub = view.checkedToday ? t('streak.compact.done') : t('streak.compact.ready', { n: view.nextBonus });

  return (
    <div ref={host} className="card stk stk--compact" data-ready={!view.checkedToday || undefined}>
      <button
        className="stk__main"
        onClick={() => {
          haptic.tap();
          useNav.getState().push({ name: 'rewards' });
        }}
      >
        <Flame cold={cold} pop={float?.key ?? 0} size={36} innerRef={flame} />
        <span className="stk__txt">
          <b className="stk__h">{headline}</b>
          <span className="stk__sub">{sub}</span>
        </span>
      </button>
      {view.checkedToday ? (
        <span className="stk__chip stk__chip--wait" aria-label={t('streak.next', { t: fmtDuration(msToMidnight(now)) })}>
          <IconTimer size={13} />
          <NextIn />
        </span>
      ) : (
        <button ref={chip} className="stk__chip stk__chip--go num" onClick={claim} aria-label={t('streak.claim', { n: view.nextBonus })}>
          <Obj name="coin" size={20} />+{view.nextBonus}
        </button>
      )}
      <span className="sr-only" role="status">
        {float ? t('streak.added', { n: fmtNumber(float.bonus) }) : ''}
      </span>
      <CoinLayer />
    </div>
  );
}
