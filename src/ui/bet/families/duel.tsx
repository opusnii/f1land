/* Duel (F1-M02/M07/M16): two stable A/B driver cards (order never follows the race, F1-039), two cars nose to nose and the gap between them. */
import type { CSSProperties } from 'react';
import { DRIVER_BY_ID, TEAM_BY_ID } from '@/data/teams';
import { driverCode } from '@/app/poolText';
import { t } from '@/i18n/core';
import { Helmet } from '@/ui/Helmet';
import { CarArt, Obj } from '@/ui/Obj';
import type { LiveCar } from '@/sim/types';
import { GapMeter, teamColorOf, tyreObj, useGapTrend } from '../viz';

export function DuelInfo({ a, b, ca, cb, quali }: { a: string; b: string; ca?: LiveCar; cb?: LiveCar; quali: boolean }) {
  // Race: difference of gaps to the leader (A minus B, so negative = A ahead). Quali: best-lap delta.
  const gap = quali
    ? ca?.segmentBestMs && cb?.segmentBestMs
      ? ca.segmentBestMs - cb.segmentBestMs
      : null
    : ca && cb && ca.gapMs !== null && cb.gapMs !== null
      ? ca.gapMs - cb.gapMs
      : ca && cb && ca.position === 1 && cb.gapMs !== null
        ? -cb.gapMs
        : ca && cb && cb.position === 1 && ca.gapMs !== null
          ? ca.gapMs
          : null;
  const trend = useGapTrend(quali ? null : gap);
  const ahead = gap === null || gap === 0 ? null : gap < 0 ? a : b;
  const teamA = DRIVER_BY_ID[a]?.teamId ?? '';
  const teamB = DRIVER_BY_ID[b]?.teamId ?? '';
  return (
    <section className="duel2" aria-label={`${driverCode(a)} — ${driverCode(b)}`}>
      <div className="duel2__cards">
        {[
          { id: a, c: ca, tag: 'a' },
          { id: b, c: cb, tag: 'b' },
        ].map(({ id, c, tag }) => {
          const d = DRIVER_BY_ID[id]!;
          const team = TEAM_BY_ID[d.teamId]!;
          const tyre = tyreObj(c?.tyre);
          return (
            <div key={id} className={`duel2__card duel2__card--${tag}`} style={{ '--team': team.color } as CSSProperties}>
              <span className="duel2__num" aria-hidden="true">
                {d.number}
              </span>
              <Helmet driverId={id} size={56} ring decorative />
              <span className="duel2__first">{d.firstName}</span>
              <b className="duel2__last">{d.lastName}</b>
              <span className="duel2__team">{team.shortName}</span>
              <span className="duel2__meta">
                <span className="num duel2__pos">{c ? `P${c.position}` : '—'}</span>
                {c && !quali && tyre && <Obj name={tyre} size={22} alt={t(`tyre.${c.tyre.toLowerCase()}`)} />}
                {c && !quali && (
                  <small className="num">
                    {t('pv2.lapsN', { n: c.tyreAgeLaps })}
                  </small>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="duel2__stage" style={{ '--ta': teamColorOf(a), '--tb': teamColorOf(b) } as CSSProperties}>
        <div className="duel2__cars" aria-hidden="true">
          <CarArt team={teamA} width={164} mirror className="duel2__car duel2__car--a" />
          <CarArt team={teamB} width={164} className="duel2__car duel2__car--b" />
        </div>
        <GapMeter a={a} b={b} gapMs={gap} trend={trend} label={quali ? t('live.bestLap') : t('live.gap')} />
        {ahead && <p className="duel2__ahead">{t('pv2.ahead', { d: driverCode(ahead) })}</p>}
      </div>
    </section>
  );
}
