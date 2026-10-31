import { memo } from 'react';
import { multiplier, type LivePool } from '@/demo/poolEngine';
import { poolPlate } from '@/assets';
import { fmtCountdown, fmtNumber, fmtOdds, t } from '@/i18n/core';
import { layoutOf, outcomeShort, poolTexts } from '@/app/poolText';
import { msUntilLock } from '@/domain/lifecycle';
import { Art } from '@/ui/Art';
import { DisplayTitle } from '@/ui/primitives';
import { LockTimer } from '@/ui/LockTimer';
import { IconArrow } from '@/ui/icons';
import { haptic } from '@/telegram/sdk';
import { MechIcon, mechName, outcomeVisual } from './mechanics';

/** The three shortest-priced outcomes: what most players are backing right now. */
export function topOutcomes(lp: LivePool, n = 3) {
  return [...lp.pool.outcomes]
    .map((o) => ({ o, m: multiplier(lp.book, o.id) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, n);
}

/**
 * Next prediction (spec §9.1 item 3): 88 px mechanic plate with its display title, the question,
 * three S2 outcome tiles with an object, the lock timer and the primary CTA.
 */
export const NextPrediction = memo(function NextPrediction({ lp, now, onOpen }: { lp: LivePool; now: number; onOpen: () => void }) {
  const tx = poolTexts(lp.pool);
  const family = layoutOf(lp.pool);
  const ms = msUntilLock(lp.pool, now);
  const total = Date.parse(lp.pool.closes_at) - Date.parse(lp.pool.opens_at);
  const accept = lp.pool.status === 'OPEN' && lp.pool.intake_status === 'ACCEPTING' && ms > 0;
  const bank = Object.values(lp.book.stakes).reduce((a, b) => a + b, 0);
  const open = () => {
    haptic.tap();
    onOpen();
  };
  return (
    <article
      className="card hm-next"
      role="button"
      tabIndex={0}
      aria-label={`${tx.question}. ${t('home.locksIn')} ${fmtCountdown(ms)}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <Art name={poolPlate(family)} scrim="l" focal="72% 50%" sizes="(max-width: 480px) calc(100vw - 32px), 448px" className="hm-next__plate">
        <div className="hm-next__plate-body">
          <DisplayTitle as="h3" size="md" icon={<MechIcon family={family} size={22} />}>
            {mechName(family)}
          </DisplayTitle>
          <span className="hm-next__meta">{t('hl.next.meta', { bank: fmtNumber(bank), n: fmtNumber(lp.book.players) })}</span>
        </div>
      </Art>
      <div className="hm-next__body">
        <p className="hm-next__q">{tx.question}</p>
        <div className="hm-next__outs">
          {topOutcomes(lp).map(({ o, m }) => {
            const vis = outcomeVisual(o, lp.pool, 26);
            return (
              <span key={o.id} className="tile hm-out">
                <span className="hm-out__vis" aria-hidden="true">
                  {vis ?? <MechIcon family={family} size={20} />}
                </span>
                <span className="hm-out__txt">
                  <span className="hm-out__l">{outcomeShort(o, lp.pool)}</span>
                  <b className="num">×{fmtOdds(m)}</b>
                </span>
              </span>
            );
          })}
        </div>
        <div className="hm-next__foot">
          <LockTimer ms={ms} totalMs={total} accept={accept} status={lp.pool.status} />
          <span className="btn btn--primary hm-next__cta">
            {t('lv.predict')} <IconArrow size={16} />
          </span>
        </div>
      </div>
    </article>
  );
});
