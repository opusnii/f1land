/* Pit (F1-M03/M05/M06): pit-lane plate with the in → box → out scheme, the drivers' tyres and the outcome thresholds. No predicted pit window: the sim does not compute one. */
import type { CSSProperties } from 'react';
import { poolPlate } from '@/assets';
import type { Pool } from '@/domain/types';
import type { LiveCar } from '@/sim/types';
import { driverCode } from '@/app/poolText';
import { fmtSec, t } from '@/i18n/core';
import { Art } from '@/ui/Art';
import { Helmet } from '@/ui/Helmet';
import { Obj } from '@/ui/Obj';
import { IconPit } from '@/ui/icons';
import { teamColorOf, tyreObj } from '../viz';
import { DriverStrip, InfoCard, teamShort } from './common';

type LaneMode = 'entry' | 'service' | 'lane';

function PitScheme({ mode }: { mode: LaneMode }) {
  const on = (k: 'in' | 'box' | 'out') => mode === 'lane' || (mode === 'service' && k === 'box') || (mode === 'entry' && k === 'in');
  return (
    <div className={`pitscheme pitscheme--${mode}`} aria-hidden="true">
      <span className="techlabel pitscheme__k">{t('pv2.pitLane')}</span>
      <div className="pitscheme__road">
        <span className="pitscheme__line" />
        {(['in', 'box', 'out'] as const).map((k) => (
          <span key={k} className={`pitscheme__node ${on(k) ? 'is-on' : ''}`}>
            <span className="pitscheme__dot">{k === 'box' ? <IconPit size={14} /> : null}</span>
            <span className="pitscheme__label">{k === 'in' ? t('pv2.pitIn') : k === 'out' ? t('pv2.pitOut') : t('pv2.pitBox')}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TyreCell({ c }: { c: LiveCar }) {
  const o = tyreObj(c.tyre);
  return (
    <span className="pv-tyre">
      {o && <Obj name={o} size={34} alt={t(`tyre.${c.tyre.toLowerCase()}`)} />}
      <span className="num">{t('pv2.lapsN', { n: c.tyreAgeLaps })}</span>
    </span>
  );
}

export function PitInfo({ pool, car, focus, cars }: { pool: Pool; car?: LiveCar; focus: string[]; cars: LiveCar[] }) {
  const m = pool.market_id;
  const p = pool.target.parameters;
  const mode: LaneMode = m === 'F1-M03' ? 'entry' : m === 'F1-M05' ? 'service' : 'lane';
  const cands = m === 'F1-M03' ? (focus.map((id) => cars.find((c) => c.id === id)).filter(Boolean) as LiveCar[]) : [];
  return (
    <InfoCard className="pitinfo">
      <div className="pitinfo__plate">
        <Art name={poolPlate('pit')} scrim="l" focal="72% 50%" className="pitinfo__art" />
        <PitScheme mode={mode} />
      </div>
      {car && m !== 'F1-M03' && <DriverStrip id={car.id} sub={`${teamShort(car.id)} · P${car.position} · ${t('pv2.stops', { n: car.pitStops })}`} right={<TyreCell c={car} />} />}
      {cands.length > 0 && (
        <div className="pv-list">
          <span className="pv-label">{t('pl.pitCandidates')}</span>
          {cands.map((c) => (
            <div key={c.id} className="pv-row" style={{ '--team': teamColorOf(c.id) } as CSSProperties}>
              <Helmet driverId={c.id} size={30} decorative />
              <b className="pv-row__code">{driverCode(c.id)}</b>
              <TyreCell c={c} />
              <span className="wearbar" title={t('pl.wear')}>
                <span style={{ width: `${Math.round(Math.min(1, c.tyreWear) * 100)}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
      {p.t1_ms !== undefined && p.t2_ms !== undefined && (
        <div className="pv-band">
          <Obj name="stopwatch" size={32} />
          <span className="pv-band__t">
            <small>{m === 'F1-M05' ? t('f1.pit.stationary') : t('f1.pit.lane')}</small>
            <b className="num">
              {fmtSec(p.t1_ms, 1)} · {fmtSec(p.t2_ms, 1)} {t('pl.unit.s')}
            </b>
          </span>
          <span className="pv-band__k">{t('pv2.band')}</span>
        </div>
      )}
    </InfoCard>
  );
}
