import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { useNav } from '@/store/nav';
import { fmtNumber, fmtOdds, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { signed, useReduced } from '@/screens/common';
import { Art } from '@/ui/Art';
import { Obj } from '@/ui/Obj';
import { Tagline } from '@/ui/primitives';
import { CountUp } from '@/ui/bet/motionBits';
import { IconCheck, IconClose } from '@/ui/icons';
import { AchBadge } from '@/ui/profile/objects';
import { describeWin, places, useExtras, type LevelUp } from './extras';
import { useDismissTimer, useModalFocus } from './hooks';
import type { QueuedMoment } from './store';

const WIN_MS = 6000;
/** Coins thrown up from the payout figure: [x offset px, peak px, delay s, size]. */
const COINS: Array<[number, number, number, number]> = [
  [-118, -86, 0.18, 30],
  [-64, -132, 0.26, 36],
  [-14, -158, 0.2, 28],
  [48, -138, 0.3, 34],
  [104, -96, 0.22, 30],
  [140, -54, 0.34, 24],
];

const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

/** Full-screen win: floodlit podium plate, payout count-up, one tagline. Auto-closes after 6 s; tap, Esc or "Continue" skips. */
export function WinMoment({ m, onDone }: { m: QueuedMoment; onDone: (levelUp: LevelUp | null) => void }) {
  const reduced = useReduced();
  const present = useIsPresent();
  const x = useExtras(m);
  const root = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const descId = useId();
  const [amount, setAmount] = useState(reduced ? m.payout : 0);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone(x.levelUp);
  }, [onDone, x.levelUp]);
  const timer = useDismissTimer(WIN_MS, finish, present);
  const onKeyDown = useModalFocus(root, present);

  useEffect(() => {
    haptic.win();
    sfx.celebrate();
    const ids = [window.setTimeout(() => setAmount(m.payout), reduced ? 0 : 320)];
    if (x.badges.length)
      ids.push(
        window.setTimeout(() => {
          sfx.unlock();
          haptic.impact('light');
        }, 1400),
      );
    return () => ids.forEach((id) => window.clearTimeout(id));
    // Runs once per moment: the component is keyed by the moment id.
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const finalText = `+${fmtNumber(m.payout)}`;
  const shownBadges = x.badges.slice(0, 2);

  return (
    <motion.div
      ref={root}
      className="cel cel--win"
      data-reduced={reduced || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={t('cel.win.aria')}
      aria-describedby={descId}
      aria-live="polite"
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: reduced ? 0.15 : 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={present ? undefined : { pointerEvents: 'none' }}
      onKeyDown={onKeyDown}
      onPointerDownCapture={timer.stop}
    >
      <p id={descId} className="sr-only">
        {describeWin(m, x)}
      </p>
      <Art name="cel-win" priority sizes="100vw" focal="50% 40%" className="cel__plate" />
      <div className="cel__shade" onClick={finish} />

      <div className="cel__top">
        <span className="cel__kicker">{t('cel.win.kicker')}</span>
        <button type="button" className="cel__skip" onClick={finish} aria-label={t('pv2.cel.skip')}>
          <IconClose size={18} />
        </button>
      </div>

      <div className="cel__scroll">
        <div className="cel__hero" aria-hidden="true">
          <div className="cel__pay" data-long={finalText.length > 8 || undefined}>
            {!reduced && (
              <span className="cel__coins">
                {COINS.map(([dx, peak, d, size], i) => (
                  <span key={i} className="cel__coin" style={{ '--dx': `${dx}px`, '--peak': `${peak}px`, '--d': `${d}s` } as CSSProperties}>
                    <Obj name="coin" size={size} priority />
                  </span>
                ))}
              </span>
            )}
            <span className="cel__amt num">
              <span className="cel__ghost">{finalText}</span>
              <CountUp className="cel__live" value={amount} duration={1100} format={(n) => `+${fmtNumber(n)}`} />
            </span>
            <span className="cel__unit">PULSE</span>
          </div>
          <Tagline className="cel__tag">{t('tag.rewards')}</Tagline>
        </div>

        <div className="cel__col">
          <div className="cel__chips cel__rise" style={delay(0.45)}>
            <span className="cel__chip cel__chip--mult num">×{fmtOdds(m.mult)}</span>
            <span className="cel__chip num">{t('cel.stake', { n: fmtNumber(m.stake) })}</span>
            <span className="cel__chip cel__chip--net num">{t('cel.net', { n: signed(m.payout - m.stake, fmtNumber) })}</span>
          </div>

          <div className="card card--glass cel__ticket cel__rise" style={delay(0.55)}>
            <div className="cel__q">{m.title}</div>
            <div className="cel__row">
              <span className="cel__k">{t('cel.pick')}</span>
              <b className="cel__v cel__v--ok">
                <IconCheck size={15} />
                <span>{m.pick}</span>
              </b>
            </div>
            {m.winner && m.winner !== m.pick && (
              <div className="cel__row">
                <span className="cel__k">{t('cel.result')}</span>
                <b className="cel__v">{m.winner}</b>
              </div>
            )}
            <div className="cel__meta num">
              <span>+{fmtNumber(m.xp)} XP</span>
              {x.rank && (
                <span>
                  {t('cel.rank')} #{fmtNumber(x.rank.now)}
                  {x.rank.up > 0 && (
                    <b className="cel__up">
                      {' '}
                      ▲ {fmtNumber(x.rank.up)} {places(x.rank.up)}
                    </b>
                  )}
                </span>
              )}
            </div>
          </div>

          {shownBadges.map((a, i) => (
            <div key={a.def.id} className="card card--glass cel__ach cel__rise" style={delay(1.1 + i * 0.15)}>
              <AchBadge a={a} size={44} />
              <span className="cel__achtxt">
                <span className="cel__k">{t('cel.badge')}</span>
                <b>{t(`scr.ach.${a.def.id}`)}</b>
              </span>
              {i === shownBadges.length - 1 && x.badges.length > shownBadges.length && <span className="cel__more num">{t('cel.badge.more', { n: x.badges.length - shownBadges.length })}</span>}
            </div>
          ))}

          <div className="cel__actions cel__rise" style={delay(0.7)}>
            <button
              className="btn btn--ghost"
              onClick={() => {
                haptic.tap();
                useNav.getState().push({ name: 'entry', entryId: m.entryId });
                finish();
              }}
            >
              {t('cel.proof')}
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                haptic.tap();
                finish();
              }}
            >
              {t('cel.continue')}
            </button>
          </div>
        </div>
      </div>
      <i className="cel__timer" data-state={timer.state} style={{ '--ms': `${WIN_MS}ms` } as CSSProperties} aria-hidden="true" />
    </motion.div>
  );
}
