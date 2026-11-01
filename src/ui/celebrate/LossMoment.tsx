import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { useNav } from '@/store/nav';
import { fmtNumber, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { useReduced } from '@/screens/common';
import { Art } from '@/ui/Art';
import { IconChevron, IconClose } from '@/ui/icons';
import { useExtras, type LevelUp } from './extras';
import { useDismissTimer } from './hooks';
import type { QueuedMoment } from './store';

const LOSS_MS = 4000;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Loss: a calm card over the rainy pit-lane plate. No shake, never blocks the app, gone in 4 s. */
export function LossMoment({ m, onDone }: { m: QueuedMoment; onDone: (levelUp: LevelUp | null) => void }) {
  const reduced = useReduced();
  const present = useIsPresent();
  const x = useExtras(m);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone(x.levelUp);
  }, [onDone, x.levelUp]);
  const timer = useDismissTimer(LOSS_MS, finish, present);

  useEffect(() => {
    sfx.soft();
    haptic.impact('soft');
    const id = x.badges.length ? window.setTimeout(() => sfx.unlock(), 700) : 0;
    return () => window.clearTimeout(id);
    // Runs once per moment: the component is keyed by the moment id.
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const hasWinner = !!m.winner;
  const extra = x.badges.length > 0 ? [`${t('cel.badge')}: ${x.badges.map((a) => t(`scr.ach.${a.def.id}`)).join(', ')}`] : [];
  const base = hasWinner ? t('cel.loss.sr', { pick: m.pick, winner: m.winner ?? '', n: fmtNumber(m.stake) }) : t('cel.loss.srNoWinner', { pick: m.pick, n: fmtNumber(m.stake) });
  const spoken = [base, ...extra].join(' ');
  // Live regions announce changes, not their first paint, so the text lands a beat after mount.
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setAnnounce(spoken), 80);
    return () => window.clearTimeout(id);
  }, [spoken]);

  return (
    <div className="cel-loss" data-reduced={reduced || undefined} style={present ? undefined : { pointerEvents: 'none' }}>
      <motion.div
        className="card cel-loss__card"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
        transition={{ duration: reduced ? 0.15 : 0.32, ease: EASE_OUT }}
        drag={reduced ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragStart={timer.stop}
        onDragEnd={(_, info) => {
          if (info.offset.y > 36 || info.velocity.y > 420) finish();
        }}
        onPointerDownCapture={timer.stop}
      >
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        <Art name="cel-loss" focal="50% 62%" className="cel-loss__plate" />
        <div className="cel-loss__body">
          <div className="cel-loss__head">
            <span className="cel-loss__txt" aria-hidden="true">
              <b>{t('cel.loss.title')}</b>
              <span className="cel-loss__q">{m.title}</span>
            </span>
            <button className="cel-loss__x" aria-label={t('ui.close')} onClick={finish}>
              <IconClose size={16} />
            </button>
          </div>

          <div className="cel-loss__cmp" aria-hidden="true">
            <div className="cel-loss__cell">
              <span className="cel__k">{t('cel.pick')}</span>
              <b>{m.pick}</b>
            </div>
            {hasWinner && (
              <div className="cel-loss__cell">
                <span className="cel__k">{t('cel.result')}</span>
                <b>{m.winner}</b>
              </div>
            )}
          </div>

          <div className="cel-loss__foot">
            <span className="cel-loss__stake num" aria-hidden="true">
              −{fmtNumber(m.stake)} <small>PULSE</small>
            </span>
            <span className="cel-loss__chip num" aria-hidden="true">
              +{fmtNumber(m.xp)} XP
            </span>
            {x.badges.length > 0 && (
              <span className="cel-loss__chip" aria-hidden="true">
                {t(`scr.ach.${x.badges[0]!.def.id}`)}
              </span>
            )}
            <button
              className="cel-loss__proof"
              onClick={() => {
                haptic.tap();
                useNav.getState().push({ name: 'entry', entryId: m.entryId });
                finish();
              }}
            >
              {t('cel.proof')}
              <IconChevron size={14} />
            </button>
          </div>
        </div>
        <i className="cel-loss__timer" data-state={timer.state} style={{ '--ms': `${LOSS_MS}ms` } as CSSProperties} aria-hidden="true" />
      </motion.div>
    </div>
  );
}
