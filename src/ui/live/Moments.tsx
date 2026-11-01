/* Live moments (spec §6): SC/VSC/RED banner, the followed driver's overtakes, the finish; small toasts for the rest. */
import { useEffect } from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { useLive, onMoment } from '@/store/live';
import { DRIVER_BY_ID } from '@/data/teams';
import type { Moment } from '@/sim/types';
import { t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { useReduced } from '@/screens/common';
import { Obj } from '@/ui/Obj';
import { Helmet } from '@/ui/Helmet';
import { MOMENT_TONE, MomentIcon, momentText } from '@/ui/bet/livePanels';

type Neutral = 'SC' | 'VSC' | 'RED';

type StackItem =
  | { type: 'toast'; id: string; m: Moment; big: boolean }
  | { type: 'overtake'; id: string; a: string; b: string; follow: string; gain: boolean; pos: number | null; lap: number }
  | { type: 'finish'; id: string; podium: string[] };

interface MomentUi {
  banner: { id: string; kind: Neutral; lap: number } | null;
  item: StackItem | null;
  /** Key of the running chequered-flag pass (0 = none). */
  flagPass: number;
}

const useMomentUi = create<MomentUi>(() => ({ banner: null, item: null, flagPass: 0 }));

/** Banner hold after the entrance (spec: held 2.5 s). */
const BANNER_MS = 2500 + 320;
const FLAG_PASS_MS = 900;
const timers = new Map<string, number>();

function later(key: string, ms: number, fn: () => void) {
  window.clearTimeout(timers.get(key));
  timers.set(key, window.setTimeout(fn, ms));
}

let battles = 0;

function present(m: Moment, reduced: boolean) {
  const { followId, rivalId, live } = useLive.getState();
  const set = useMomentUi.setState;
  const involved = m.drivers.some((d) => d === followId || d === rivalId);

  if (m.kind === 'SC' || m.kind === 'VSC' || m.kind === 'RED') {
    haptic.notify('warning');
    sfx.warn();
    set({ banner: { id: m.id, kind: m.kind, lap: m.lap } });
    later('banner', BANNER_MS, () => set({ banner: null }));
    return;
  }
  if (m.kind === 'OVERTAKE' && followId && m.drivers.slice(0, 2).includes(followId) && m.drivers[1]) {
    haptic.impact('medium');
    sfx.overtake();
    const [a, b] = m.drivers as [string, string];
    const pos = live?.cars.find((c) => c.id === followId)?.position ?? null;
    set({ item: { type: 'overtake', id: m.id, a, b, follow: followId, gain: a === followId, pos, lap: m.lap } });
    later('item', 4200, () => set((s) => (s.item?.id === m.id ? { item: null } : s)));
    return;
  }
  if (m.kind === 'FINISH') {
    haptic.notify('success');
    const podium = (live?.cars ?? []).slice(0, 3).map((c) => c.id);
    if (!podium.length && m.drivers[0]) podium.push(m.drivers[0]);
    const showResults = () => {
      set({ flagPass: 0, item: { type: 'finish', id: m.id, podium } });
      later('item', 9000, () => set((s) => (s.item?.id === m.id ? { item: null } : s)));
    };
    if (reduced) showResults();
    else {
      set({ flagPass: Date.now() });
      later('finish', FLAG_PASS_MS, showResults);
    }
    return;
  }
  if (m.kind === 'BATTLE' && !involved && battles++ % 2 === 1) return;
  if (m.kind === 'TRACK_LIMITS' && !involved) return;
  const big = m.kind === 'OVERTAKE' && involved;
  if (big) haptic.impact('medium');
  else if ((m.kind === 'FASTEST_LAP' || m.kind === 'PIT') && involved) haptic.impact('light');
  // One moment at a time: a new one replaces the previous.
  set({ item: { type: 'toast', id: m.id, m, big } });
  later('item', big ? 4200 : 3200, () => set((s) => (s.item?.id === m.id ? { item: null } : s)));
}

/** Subscribes the Live screen to session moments. Mount once. */
export function useMomentFeed() {
  const reduced = useReduced();
  useEffect(() => {
    const off = onMoment((m) => present(m, reduced));
    // DEV: `__moment('SC')`, `__moment('OVERTAKE')`, `__moment('FINISH')` to capture the moments on demand.
    if (import.meta.env.DEV) {
      Object.assign(window, {
        __moment: (kind: Moment['kind'], drivers?: string[]) => {
          const { live, followId } = useLive.getState();
          const cars = live?.cars ?? [];
          const f = cars.find((c) => c.id === followId);
          const ahead = f ? cars.find((c) => c.position === f.position + 1) : cars[1];
          present({ id: `dev-${Date.now()}`, kind, t: 0, atMs: Date.now(), lap: live?.leaderLap ?? 1, drivers: drivers ?? [followId ?? cars[0]?.id ?? '', ahead?.id ?? ''] }, reduced);
        },
      });
    }
    return () => {
      off();
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      useMomentUi.setState({ banner: null, item: null, flagPass: 0 });
    };
  }, [reduced]);
}

const BANNER_OBJ: Record<Neutral, string> = { SC: 'safety-car', VSC: 'vsc-board', RED: 'flag-red' };

/** Full-width banner across the top for neutralisations. */
export function MomentBanner() {
  const banner = useMomentUi((s) => s.banner);
  const reduced = useReduced();
  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          className={`lv-banner lv-banner--${banner.kind === 'RED' ? 'red' : 'sc'}`}
          role="alert"
          initial={reduced ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="lv-banner__sweep" aria-hidden="true" />
          <Obj name={BANNER_OBJ[banner.kind]} size={48} className="lv-banner__obj" />
          <span className="lv-banner__txt">
            <span className="techlabel">
              {banner.kind} · {t('hl.moment.lap', { n: Math.max(1, banner.lap) })}
            </span>
            <b>{t(`rc.${banner.kind}`)}</b>
          </span>
          <span className="lv-banner__bar" aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The chequered flag crosses the screen before the results card. */
export function FlagPass() {
  const key = useMomentUi((s) => s.flagPass);
  if (!key) return null;
  return (
    <div key={key} className="lv-flagpass" aria-hidden="true">
      <Obj name="flag-chequered" size={120} priority />
    </div>
  );
}

function Arrow() {
  return (
    <svg className="lv-ot__arrow" width="28" height="16" viewBox="0 0 28 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 8h22M18 2l6 6-6 6" />
    </svg>
  );
}

function code(id: string) {
  return DRIVER_BY_ID[id]?.code ?? id;
}

/** Stack above the drawer: the current moment card or toast. */
export function MomentStack({ onResults }: { onResults: () => void }) {
  const item = useMomentUi((s) => s.item);
  const reduced = useReduced();
  return (
    <div className="lv-moments" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {item && (
          <motion.div
            key={item.id}
            className="lv-moments__slot"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.16 } }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {item.type === 'toast' && (
              <div className={`lv-moment ${item.big ? 'lv-moment--big' : ''} lv-moment--${item.m.kind.toLowerCase()}`} style={{ ['--tone' as string]: MOMENT_TONE[item.m.kind] ?? 'var(--text-2)' }}>
                <span className="lv-moment__icon">
                  <MomentIcon kind={item.m.kind} size={16} />
                </span>
                <span className="lv-moment__text">{momentText(item.m)}</span>
              </div>
            )}
            {item.type === 'overtake' && (
              <div className={`lv-ot ${item.gain ? 'lv-ot--gain' : 'lv-ot--loss'}`} role="status" aria-label={t('hl.ot.aria', { a: DRIVER_BY_ID[item.a]?.lastName ?? item.a, b: DRIVER_BY_ID[item.b]?.lastName ?? item.b })}>
                <span className="lv-ot__kicker techlabel">
                  {t('hl.ot.kicker')} · {t('hl.moment.lap', { n: Math.max(1, item.lap) })}
                </span>
                <span className="lv-ot__row" aria-hidden="true">
                  <span className={`lv-ot__drv ${item.a === item.follow ? 'lv-ot__drv--you' : ''}`}>
                    <Helmet driverId={item.a} size={32} num={false} decorative />
                    <b>{code(item.a)}</b>
                  </span>
                  <Arrow />
                  <span className={`lv-ot__drv ${item.b === item.follow ? 'lv-ot__drv--you' : ''}`}>
                    <Helmet driverId={item.b} size={32} num={false} decorative />
                    <b>{code(item.b)}</b>
                  </span>
                  {item.pos !== null && <span className="lv-ot__pos num">P{item.pos}</span>}
                </span>
                <span className="lv-ot__sub">{item.gain ? t('hl.ot.gain', { d: code(item.follow), p: item.pos ?? '—' }) : t('hl.ot.loss', { d: code(item.follow) })}</span>
              </div>
            )}
            {item.type === 'finish' && (
              <div className="lv-fin" role="status">
                <Obj name="flag-chequered" size={44} className="lv-fin__flag" />
                <span className="lv-fin__txt">
                  <span className="techlabel">{t('hl.fin.kicker')}</span>
                  <b>{t('hl.fin.winner', { d: DRIVER_BY_ID[item.podium[0] ?? '']?.lastName ?? '' })}</b>
                  <ol className="lv-fin__podium" aria-label={t('hl.fin.podium')}>
                    {item.podium.map((id, i) => (
                      <li key={id}>
                        <span className="num">{i + 1}</span>
                        <Helmet driverId={id} size={22} num={false} decorative />
                        <b>{code(id)}</b>
                      </li>
                    ))}
                  </ol>
                </span>
                <button type="button" className="btn btn--ghost btn--sm lv-fin__go" onClick={onResults}>
                  {t('hl.fin.results')}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
