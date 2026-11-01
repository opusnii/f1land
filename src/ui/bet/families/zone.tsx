/* Zone (F1-M11): the followed driver — helmet, "P6 · +4.2", where they are now, and a switch to another driver's zone pool. */
import { useState, type CSSProperties } from 'react';
import { useNav } from '@/store/nav';
import { useLive } from '@/store/live';
import { usePools } from '@/demo/poolEngine';
import { canAcceptEntry, msUntilLock } from '@/domain/lifecycle';
import { useSessionNow } from '@/app/hooks';
import { DRIVER_BY_ID } from '@/data/teams';
import { fmtCountdown, fmtGap, t } from '@/i18n/core';
import { Sheet } from '@/ui/kit';
import { Helmet } from '@/ui/Helmet';
import { IconChevron, IconSwap } from '@/ui/icons';
import { SECTOR_COLORS } from '@/ui/TrackMap';
import { haptic } from '@/telegram/sdk';
import type { LiveCar } from '@/sim/types';
import { DriverStrip, InfoCard } from './common';

export function ZoneInfo({ car, poolId }: { car: LiveCar; poolId: string }) {
  const [open, setOpen] = useState(false);
  const onTrack = car.occupancy === 'ON_TRACK';
  const where = onTrack ? `S${car.sector}` : t(`occ.${car.occupancy}`);
  return (
    <InfoCard className="zinfo">
      <DriverStrip
        id={car.id}
        size={52}
        right={
          <button
            type="button"
            className="btn btn--ghost btn--sm zinfo__chg"
            onClick={() => {
              haptic.tap();
              setOpen(true);
            }}
          >
            <IconSwap size={16} /> {t('pv2.change')}
          </button>
        }
      />
      <div className="zinfo__now">
        <p className="zinfo__pos">
          <b className="num">P{car.position}</b>
          <small>
            {car.position === 1 ? (
              t('pv2.leader')
            ) : (
              <>
                <span className="num">
                  {fmtGap(car.gapMs, 1)} {t('pl.unit.s')}
                </span>{' '}
                {t('pv2.toLeader')}
              </>
            )}
          </small>
        </p>
        <div className="zinfo__where">
          <small>{t('pv2.whereNow')}</small>
          <ol className="zinfo__secs" role="img" aria-label={`${t('pv2.whereNow')}: ${where}`}>
            {([1, 2, 3] as const).map((s) => (
              <li key={s} className={onTrack && car.sector === s ? 'is-on' : ''} style={{ '--zc': SECTOR_COLORS[s - 1] } as CSSProperties}>
                <span className="techlabel">S{s}</span>
              </li>
            ))}
          </ol>
          {!onTrack && <span className="zinfo__occ">{where}</span>}
        </div>
      </div>
      <OtherZonePools open={open} onClose={() => setOpen(false)} current={poolId} />
    </InfoCard>
  );
}

function OtherZonePools({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const pools = usePools((s) => s.pools);
  const live = useLive((s) => s.live);
  const now = useSessionNow();
  const others = open ? pools.filter((lp) => lp.pool.market_id === 'F1-M11' && lp.pool.pool_id !== current && lp.pool.subject.driver_a && canAcceptEntry(lp.pool, now)) : [];
  return (
    <Sheet open={open} onClose={onClose} title={t('pv2.changeTitle')} label={t('pv2.changeTitle')}>
      {others.length === 0 ? (
        <p className="zinfo__empty">{t('pv2.changeEmpty')}</p>
      ) : (
        <ul className="zinfo__list">
          {others.map((lp) => {
            const id = lp.pool.subject.driver_a!;
            const d = DRIVER_BY_ID[id];
            const pos = live?.cars.find((c) => c.id === id)?.position;
            return (
              <li key={lp.pool.pool_id}>
                <button
                  type="button"
                  className="zinfo__row"
                  onClick={() => {
                    haptic.tap();
                    onClose();
                    // Replace this pool route so Back still returns to where the user came from.
                    useNav.setState((s) => ({ stack: [...s.stack.slice(0, -1), { name: 'pool', channelId: useLive.getState().channelId, poolId: lp.pool.pool_id }], dir: 1 }));
                  }}
                >
                  <Helmet driverId={id} size={36} decorative />
                  <span className="zinfo__row-t">
                    <b>{d ? `${d.firstName} ${d.lastName}` : id}</b>
                    <small className="num">{pos ? `P${pos} · ` : ''}{fmtCountdown(msUntilLock(lp.pool, now))}</small>
                  </span>
                  <IconChevron size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
