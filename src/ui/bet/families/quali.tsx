/* Qualifying (F1-M15/M17): the provisional order around the Q1/Q2 elimination line, the driver against it. */
import { Fragment, type CSSProperties } from 'react';
import { useLive } from '@/store/live';
import type { Pool } from '@/domain/types';
import { driverCode } from '@/app/poolText';
import { fmtCountdown, fmtGap, fmtLap, t } from '@/i18n/core';
import { Helmet } from '@/ui/Helmet';
import { teamColorOf } from '../viz';
import { InfoCard } from './common';

export function QualiInfo({ pool }: { pool: Pool }) {
  const live = useLive((s) => s.live);
  const seg = live?.segment;
  if (!live || !seg) return null;
  const subject = pool.subject.driver_a;
  const active = live.cars.filter((c) => !c.eliminatedIn);
  const cut = seg.cutPosition;
  const hasCut = cut < active.length;
  const around = active.slice(Math.max(0, cut - 3), cut + 3);
  const me = subject ? active.find((c) => c.id === subject) : undefined;
  const cutCar = active.find((c) => c.position === cut);
  const toCut = me?.segmentBestMs && cutCar?.segmentBestMs && me.id !== cutCar.id ? me.segmentBestMs - cutCar.segmentBestMs : null;
  return (
    <InfoCard
      className="qinfo"
      title={
        <>
          <span className="techlabel qinfo__seg">{seg.id}</span> {t('live.remaining')} <b className="num">{fmtCountdown(seg.remainingMs)}</b>
        </>
      }
    >
      <ol className="qinfo__list">
        {around.map((c) => (
          <Fragment key={c.id}>
            <li className={`qinfo__row ${c.id === subject ? 'is-me' : ''} ${hasCut && c.position > cut ? 'is-out' : ''}`} style={{ '--team': teamColorOf(c.id) } as CSSProperties}>
              <span className="num qinfo__p">{c.position}</span>
              <Helmet driverId={c.id} size={26} num={false} decorative />
              <b className="qinfo__code">{driverCode(c.id)}</b>
              <span className="num qinfo__lap">{fmtLap(c.segmentBestMs ?? null)}</span>
            </li>
            {hasCut && c.position === cut && (
              <li className="qinfo__cut">
                <span>{t('pv2.cutLine')}</span>
              </li>
            )}
          </Fragment>
        ))}
      </ol>
      {me && (
        <p className={`qinfo__me ${hasCut && me.position > cut ? 'is-out' : 'is-in'}`}>
          <b>{hasCut && me.position > cut ? t('pv2.out') : t('pv2.through')}</b>
          {toCut !== null && (
            <span>
              {t('pv2.toCut')}: <b className="num">{fmtGap(toCut)}</b>
            </span>
          )}
        </p>
      )}
      <p className="pv-note">{t('f1.quali.provisional')}</p>
    </InfoCard>
  );
}
