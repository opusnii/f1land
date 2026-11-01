/* Tyres (F1-M04/M20): the driver's stints so far and degradation curves built only from this session's clean laps. */
import { useMemo } from 'react';
import type { LiveCar } from '@/sim/types';
import { driverCode } from '@/app/poolText';
import { fmtNumber, t } from '@/i18n/core';
import { LineChart, type Series } from '@/ui/kit';
import { Obj } from '@/ui/Obj';
import { StintBar, tyreObj } from '../viz';
import { DriverStrip, InfoCard, teamShort, useCleanLaps } from './common';

const ORDER = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as const;
/* SVG attributes need literal colours (same values as --soft/--medium/... in app.css). */
const HEX: Record<string, string> = { SOFT: '#e8002d', MEDIUM: '#ffd12e', HARD: '#f0f0ec', INTERMEDIATE: '#43b02a', WET: '#0067ad' };
const MAX_AGE = 30;
/* Laps slower than the driver's best by more than this are traffic or incidents, not wear. */
const OUTLIER_S = 4;

/** Mean delta to each driver's own best clean lap, by compound and lap-on-set. Buckets need two samples. */
function useDegradation(cars: LiveCar[]): Series[] {
  const laps = useCleanLaps();
  const stintKey = cars.map((c) => `${c.id}:${c.stints.length}:${c.stints[c.stints.length - 1]?.compound ?? ''}`).join(',');
  return useMemo(() => {
    const best = new Map<string, number>();
    for (const l of laps) best.set(l.driver, Math.min(best.get(l.driver) ?? Infinity, l.ms));
    const byId = new Map(cars.map((c) => [c.id, c]));
    const acc: Record<string, Array<{ s: number; n: number } | undefined>> = {};
    for (const l of laps) {
      const st = byId.get(l.driver)?.stints.find((s) => l.lap >= s.fromLap && (s.toLap === null || l.lap <= s.toLap));
      if (!st) continue;
      const age = l.lap - st.fromLap;
      const d = (l.ms - best.get(l.driver)!) / 1000;
      if (age < 0 || age >= MAX_AGE || d > OUTLIER_S) continue;
      const row = (acc[st.compound] ??= []);
      const cell = (row[age] ??= { s: 0, n: 0 });
      cell.s += d;
      cell.n += 1;
    }
    const series: Series[] = [];
    for (const c of ORDER) {
      const row = acc[c];
      if (!row) continue;
      const values = Array.from({ length: row.length }, (_, i) => (row[i] && row[i]!.n >= 2 ? row[i]!.s / row[i]!.n : null));
      // End label is the compound letter (fits the chart's label gutter); the legend below spells it out.
      if (values.filter((v) => v !== null).length >= 3) series.push({ id: c, color: HEX[c]!, values, label: c[0] });
    }
    const n = Math.max(0, ...series.map((s) => s.values.length));
    for (const s of series) while (s.values.length < n) s.values.push(null);
    return series;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laps, stintKey]);
}

export function TyreInfo({ car, cars, totalLaps }: { car: LiveCar; cars: LiveCar[]; totalLaps: number | null }) {
  const series = useDegradation(cars);
  const now = car.driverLaps + 1;
  const total = Math.max(totalLaps ?? 0, now, ...car.stints.map((s) => s.toLap ?? now));
  const o = tyreObj(car.tyre);
  return (
    <InfoCard className="tyreinfo">
      <DriverStrip
        id={car.id}
        sub={`${teamShort(car.id)} · P${car.position} · ${t('pv2.stops', { n: car.pitStops })}`}
        right={
          <span className="pv-tyre">
            {o && <Obj name={o} size={40} alt={t(`tyre.${car.tyre.toLowerCase()}`)} />}
            <span className="num">{t('pv2.lapsN', { n: car.tyreAgeLaps })}</span>
          </span>
        }
      />
      <div className="pv-sub">
        <span className="pv-sub__t">{t('pv2.strategy', { d: driverCode(car.id) })}</span>
        <span className="pv-sub__r num">
          {t('pv2.lapN', { n: Math.min(now, total) })}/{total}
        </span>
      </div>
      <StintBar stints={car.stints} total={total} now={now} />
      <div className="pv-sub">
        <span className="pv-sub__t">{t('pv2.degradation')}</span>
        <span className="pv-src">{t('pv2.sessionData')}</span>
      </div>
      {series.length ? (
        <div className="tyreinfo__chart">
          <p className="pv-axis">{t('pv2.degY')}</p>
          <LineChart series={series} height={150} yLabel={t('pv2.degY')} xStart={1} yFormat={(v) => (v < 0 ? `−${fmtNumber(-v, 1)}` : `+${fmtNumber(v, 1)}`)} />
          <div className="tyreinfo__foot">
            <ul className="pv-legend">
              {series.map((s) => (
                <li key={s.id}>
                  <i style={{ background: s.color }} aria-hidden="true" />
                  <b>{s.label}</b> {t(`tyre.${s.id.toLowerCase()}`)}
                </li>
              ))}
            </ul>
            <p className="pv-axis">{t('pv2.degX')} →</p>
          </div>
        </div>
      ) : (
        <p className="pv-empty">{t('pv2.degFew')}</p>
      )}
    </InfoCard>
  );
}
