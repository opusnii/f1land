import { useCallback, useEffect, useId, useRef, type CSSProperties } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { useReduced } from '@/screens/common';
import { Art } from '@/ui/Art';
import { DisplayTitle } from '@/ui/primitives';
import { IconClose } from '@/ui/icons';
import { LevelBadge } from '@/ui/profile/objects';
import { useDismissTimer, useModalFocus } from './hooks';

const LEVEL_MS = 4500;

/** Level-up: the empty hex of the plate receives the level badge. Follows the settlement moment that crossed the threshold. */
export function LevelUpMoment({ from, to, onDone }: { from: number; to: number; onDone: () => void }) {
  const reduced = useReduced();
  const present = useIsPresent();
  const root = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const titleId = useId();

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);
  const timer = useDismissTimer(LEVEL_MS, finish, present);
  const onKeyDown = useModalFocus(root, present);

  useEffect(() => {
    const id = window.setTimeout(
      () => {
        sfx.levelUp();
        haptic.notify('success');
      },
      reduced ? 0 : 380,
    );
    return () => window.clearTimeout(id);
    // Runs once per moment: the component is keyed by the level-up.
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  return (
    <motion.div
      ref={root}
      className="cel cel--level"
      data-reduced={reduced || undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: reduced ? 0.15 : 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={present ? undefined : { pointerEvents: 'none' }}
      onKeyDown={onKeyDown}
      onPointerDownCapture={timer.stop}
    >
      <Art name="cel-levelup" priority sizes="100vw" className="cel__plate" />
      <div className="cel__shade cel__shade--level" onClick={finish} />
      <div className="cel__top">
        <span className="cel__kicker">{t('cel.levelUp')}</span>
        <button type="button" className="cel__skip" onClick={finish} aria-label={t('pv2.cel.skip')}>
          <IconClose size={18} />
        </button>
      </div>
      <span className="cel-lvl__badge" aria-hidden="true">
        <LevelBadge level={to} size={132} />
      </span>
      <div className="cel-lvl__copy">
        <DisplayTitle as="h2" size="lg" className="cel-lvl__title">
          <span id={titleId}>{t('pv2.cel.level', { n: to })}</span>
        </DisplayTitle>
        <p className="cel-lvl__sub num">{t('pv2.cel.levelSub', { a: from, b: to })}</p>
        <button
          type="button"
          className="btn btn--primary btn--lg cel-lvl__go"
          onClick={() => {
            haptic.tap();
            finish();
          }}
        >
          {t('cel.continue')}
        </button>
      </div>
      <p className="sr-only" role="status">
        {t('pv2.cel.levelSr', { n: to })}
      </p>
      <i className="cel__timer" data-state={timer.state} style={{ '--ms': `${LEVEL_MS}ms` } as CSSProperties} aria-hidden="true" />
    </motion.div>
  );
}
