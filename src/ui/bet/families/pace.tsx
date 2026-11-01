/* Pace (F1-M08/M09/M19): the driver's last five clean laps against their best, the delta large, purple for the session's fastest. */
import { useMemo, type CSSProperties } from 'react';
import { useLive } from '@/store/live';
import type { Pool } from '@/domain/types';
import type { LiveCar } from '@/sim/types';
import { driverCode } from '@/app/poolText';
import { fmtGap, fmtLap, fmtSec, t } from '@/i18n/core';
import { Helmet } from '@/ui/Helmet';
import { Obj } from '@/ui/Obj';
import { SECTOR_COLORS } from '@/ui/TrackMap';
import { teamColorOf } from '../viz';
import { DriverStrip, InfoCard, teamShort, useCleanLaps } from './common';

export function PaceInfo({ pool, car }: { pool: Pool; car?: LiveCar }) {
  const live = useLive((s) => s.live);
  const all = useCleanLaps();
  const m = pool.market_id;
  const p = pool.target.parameters;
  const fl = live?.fastestLap ?? null;
  const laps = useMemo(() => (car ? all.filter((l) => l.driver === car.id).slice(-5) : []), [all, car?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = car?.bestLapMs ?? null;
  const last = laps[laps.length - 1]?.ms ?? null;
  const delta = best !== null && last !== null ? last - best : null;
  const holdsFastest = !!(car && fl && fl.driverId === car.id);
  const worst = Math.max(1, ...laps.map((l) => (best !== null ? l.ms - best : 0)));
  const top = useMemo(() => [...(live?.cars ?? [])].filter((c) => c.bestLapMs).sort((x, y) => x.bestLapMs! - y.bestLapMs!).slice(0, 4), [live]);

  return (
    <InfoCard className="paceinfo">
      {car && <DriverStrip id={car.id} sub={`${teamShort(car.id)} · P${car.position}`} size={44} right={<Obj name="stopwatch" size={40} />} />}
      <div className="pace2">
        {car && (
          <div className="pace2__big">
            <small>{m === 'F1-M08' && p.reference_time_ms !== undefined ? t('pl.reference') : t('pv2.lastVsBest')}</small>
            <b className={`num ${delta !== null && delta <= 0 ? 'purple' : ''}`}>
              {m === 'F1-M08' && p.reference_time_ms !== undefined ? fmtLap(p.reference_time_ms) : delta === null ? '—' : fmtGap(delta)}
            </b>
          </div>
        )}
        <dl className="pace2__refs">
          {car && (
            <div>
              <dt>{t('pv2.bestLap')}</dt>
              <dd className={`num ${holdsFastest ? 'purple' : ''}`}>{fmtLap(best)}</dd>
            </div>
          )}
          <div>
            <dt>{t('pv2.sessionFastest')}</dt>
            <dd className="num purple">{fmtLap(fl?.ms ?? null)}</dd>
            {fl && <dd className="pace2__who">{`${driverCode(fl.driverId)} · ${t('pv2.lapN', { n: fl.lap })}`}</dd>}
          </div>
        </dl>
      </div>

      {car && m !== 'F1-M09' && (
        <>
          <span className="pv-label">{t('pv2.recentLaps')}</span>
          {laps.length === 0 ? (
            <p className="pv-empty">{t('pv2.noLaps')}</p>
          ) : (
            <ol className="lapbars">
              {laps.map((l) => {
                const d = best !== null ? l.ms - best : null;
                const isBest = d !== null && d <= 0;
                return (
                  <li key={l.lap} className={`lapbars__row ${isBest ? (holdsFastest ? 'is-fastest' : 'is-best') : ''}`}>
                    <span className="lapbars__lap num">{t('pv2.lapN', { n: l.lap })}</span>
                    <span className="lapbars__bar" aria-hidden="true">
                      <i style={{ width: `${d === null ? 0 : Math.max(3, (d / worst) * 100)}%` }} />
                    </span>
                    <span className="lapbars__t num">{fmtLap(l.ms)}</span>
                    <span className="lapbars__d num">{d === null ? '' : isBest ? '' : fmtGap(d)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      {m === 'F1-M19' && car && p.sector && (
        <div className="sectors3">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`sectors3__c ${p.sector === s ? 'is-on' : ''}`} style={{ '--zc': SECTOR_COLORS[s - 1] } as CSSProperties}>
              <span className="techlabel">S{s}</span>
              <b className={`num ${car.sectorBest[s - 1] ? 'purple' : ''}`}>{fmtSec(car.sectorTimes[s - 1] ?? null)}</b>
            </div>
          ))}
          {p.t1_ms !== undefined && p.t2_ms !== undefined && (
            <p className="sectors3__band">
              {t('pv2.nextIn', { s: p.sector })}: <b className="num">{fmtSec(p.t1_ms, 2)} · {fmtSec(p.t2_ms, 2)} {t('pl.unit.s')}</b>
            </p>
          )}
        </div>
      )}

      {m === 'F1-M09' && top.length > 0 && (
        <div className="pv-list">
          <span className="pv-label">{t('pl.bestLaps')}</span>
          {top.map((c, i) => (
            <div key={c.id} className="pv-row" style={{ '--team': teamColorOf(c.id) } as CSSProperties}>
              <span className="pv-row__n num">{i + 1}</span>
              <Helmet driverId={c.id} size={28} decorative />
              <b className="pv-row__code">{driverCode(c.id)}</b>
              <span className={`pv-row__v num ${i === 0 ? 'purple' : ''}`}>{fmtLap(c.bestLapMs)}</span>
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  );
}
