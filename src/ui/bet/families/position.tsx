/* Position (F1-M01/M13/M14/M18): "now P1" large, the P1…Pn ladder with the driver and their grid slot, laps to go. */
import type { CSSProperties } from 'react';
import { useLive } from '@/store/live';
import type { Pool } from '@/domain/types';
import type { LiveCar } from '@/sim/types';
import { t } from '@/i18n/core';
import { teamColorOf } from '../viz';
import { DriverStrip, InfoCard, teamShort } from './common';

export function PositionInfo({ pool, car, cars }: { pool: Pool; car: LiveCar; cars: LiveCar[] }) {
  const live = useLive((s) => s.live);
  const n = cars.length || 20;
  const lap = pool.target.parameters.target_lap;
  const left = live?.totalLaps ? Math.max(0, live.totalLaps - live.leaderLap) : null;
  return (
    <InfoCard className="posinfo">
      <div className="posinfo__top">
        <DriverStrip id={car.id} sub={`${teamShort(car.id)} · ${t('pv2.grid', { n: car.gridPosition })}`} size={48} />
        <div className="posinfo__now">
          <small>{t('pv2.posNow')}</small>
          <b className="num">P{car.position}</b>
        </div>
      </div>
      <ol className="ladder" aria-label={`${t('pv2.posNow')} P${car.position}`} style={{ '--n': n, '--team': teamColorOf(car.id) } as CSSProperties}>
        {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
          <li key={p} className={`ladder__p ${p === car.position ? 'is-now' : ''} ${p === car.gridPosition ? 'is-grid' : ''} ${p <= 3 ? 'is-pod' : ''}`} aria-hidden="true">
            <span className="num">{p === car.position || p === 1 || p === n || p % 5 === 0 ? p : ''}</span>
          </li>
        ))}
      </ol>
      <div className="posinfo__foot">
        {lap !== undefined && live ? (
          <span>
            {t('pl.anchorLap')} <b className="num">{lap}</b> · {t('pl.inLaps', { n: Math.max(0, lap - live.leaderLap) })}
          </span>
        ) : left !== null ? (
          <span>
            {t('pv2.lapsLeft')} <b className="num">{left}</b>
          </span>
        ) : null}
        <span className="posinfo__legend">
          <i className="posinfo__dot posinfo__dot--grid" aria-hidden="true" /> {t('pl.grid')}
        </span>
      </div>
    </InfoCard>
  );
}
