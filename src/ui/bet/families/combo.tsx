/* Combo (F1-M21): the legs as a vertical chain — node, mechanic icon, pick, whether it holds right now — and the total multiplier. */
import type { CSSProperties, ReactNode } from 'react';
import { useLive } from '@/store/live';
import { multiplier, type LivePool } from '@/demo/poolEngine';
import type { LiveCar } from '@/sim/types';
import { comboParts, driverCode } from '@/app/poolText';
import { fmtOdds, t } from '@/i18n/core';
import { Obj } from '@/ui/Obj';
import { IconCar } from '@/ui/icons';
import { SECTOR_COLORS } from '@/ui/TrackMap';
import { IcLink, IcNo, IcPodium, IcSwords, IcYes } from '../icons';
import { SectorGlyph, tyreObj } from '../viz';
import { InfoCard } from './common';

export function legHolds(kind: string, driver: string, value: string, cars: LiveCar[]): boolean | null {
  const c = cars.find((x) => x.id === driver);
  if (!c) return null;
  switch (kind) {
    case 'POSITION_GROUP': {
      const [lo, hi] = value === 'P1' ? [1, 1] : value === 'P1_3' ? [1, 3] : value === 'P2_3' ? [2, 3] : value === 'P4_10' ? [4, 10] : value === 'P1_10' ? [1, 10] : [11, 99];
      return c.position >= lo! && c.position <= hi!;
    }
    case 'TYRE_COMPOUND':
      return c.tyre === value;
    case 'AHEAD_OF': {
      const o = cars.find((x) => x.id === value);
      return o ? c.position < o.position : null;
    }
    case 'ON_TRACK':
      return c.occupancy === 'ON_TRACK';
    case 'SECTOR':
      return c.occupancy === 'ON_TRACK' && String(c.sector) === value;
    default:
      return null;
  }
}

function LegIcon({ kind, value }: { kind: string; value: string }): ReactNode {
  const circuit = useLive((s) => s.runner?.circuit);
  if (kind === 'TYRE_COMPOUND') {
    const o = tyreObj(value);
    return o ? <Obj name={o} size={30} /> : <IcLink size={20} />;
  }
  if (kind === 'SECTOR' && circuit && /^[123]$/.test(value)) return <SectorGlyph circuit={circuit} sector={Number(value) as 1 | 2 | 3} width={34} height={24} />;
  if (kind === 'POSITION_GROUP') return <IcPodium size={20} />;
  if (kind === 'AHEAD_OF') return <IcSwords size={20} />;
  if (kind === 'ON_TRACK') return <IconCar size={20} />;
  return <IcLink size={20} />;
}

export function ComboInfo({ lp, cars }: { lp: LivePool; cars: LiveCar[] }) {
  const pool = lp.pool;
  const legs = comboParts(pool);
  const raw = pool.target.parameters.combo ?? [];
  const both = pool.outcomes.find((o) => o.id === 'BOTH_TRUE');
  const total = both ? (lp.book.finalMultipliers?.[both.id] ?? multiplier(lp.book, both.id)) : null;
  return (
    <InfoCard className="combo2">
      <ol className="combo2__chain">
        {legs.map((l, i) => {
          const r = raw[i]!;
          const holds = legHolds(r.kind, r.driver_id, r.value, cars);
          const tone = r.kind === 'SECTOR' && /^[123]$/.test(r.value) ? SECTOR_COLORS[Number(r.value) - 1] : undefined;
          return (
            <li key={i} className="combo2__leg" style={tone ? ({ '--leg': tone } as CSSProperties) : undefined}>
              <span className="combo2__node num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="combo2__ico" aria-hidden="true">
                <LegIcon kind={r.kind} value={r.value} />
              </span>
              <span className="combo2__text">
                <small className="combo2__kind">{t(`pl.combo.${l.kind.toLowerCase()}`)}</small>
                <b>{l.text}</b>
                <span className="combo2__drv">{driverCode(l.driver)}</span>
              </span>
              <span className={`combo2__now ${holds === true ? 'is-yes' : holds === false ? 'is-no' : ''}`}>
                {holds === null ? null : holds ? <IcYes size={14} /> : <IcNo size={14} />}
                <small>{holds === null ? t('pv2.unknown') : holds ? t('pv2.holds') : t('pv2.fails')}</small>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="combo2__total">
        <span className="combo2__total-t">
          <small>{t('pv2.comboTotal')}</small>
          <span>{t('pv2.comboAll')}</span>
        </span>
        <b className="num">{total === null ? '—' : `${fmtOdds(total)}x`}</b>
      </div>
    </InfoCard>
  );
}
