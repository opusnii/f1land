import { memo, type ReactNode } from 'react';
import { circuitPlate } from '@/assets';
import type { Meeting, MeetingStatus } from '@/data/calendar';
import { t } from '@/i18n/core';
import { Flag } from '@/ui/Obj';
import { DisplayTitle, HeroPlate } from '@/ui/primitives';
import { TrackMap } from '@/ui/TrackMap';
import { StatusPill, meetingDates, meetingName, safeMeta, useCircuit } from '@/screens/common';
import { countryName } from './util';

/** Plate height: the 3:2 circuit art at a 358 px column, so phones see nearly the whole frame. */
const PLATE_H = 232;

/** Neon track in the plate's upper right. The viewBox matches the CSS box at 390 px so strokes stay crisp. */
const PlateTrack = memo(function PlateTrack({ circuitId }: { circuitId: string }) {
  const c = useCircuit(circuitId);
  return <div className="rp-track">{c && <TrackMap variant="neon" circuit={c} width={216} height={150} padding={14} showPit={false} />}</div>;
});

/**
 * Circuit plate (aerial night art) with a left scrim, the neon track on the right and text overlaid as HTML.
 * The map is decorative here: the overlaid title names the race.
 */
export function RacePlate({ circuitId, children, className, priority }: { circuitId: string; children: ReactNode; className?: string; priority?: boolean }) {
  return (
    <HeroPlate art={circuitPlate(circuitId)} height={PLATE_H} scrim="l" priority={priority} className={`rp${className ? ` ${className}` : ''}`} layer={<PlateTrack circuitId={circuitId} />}>
      <div className="rp__shade" aria-hidden="true" />
      {children}
    </HeroPlate>
  );
}

/** Overlay layout: a status row on top, kicker + display title + meta anchored to the bottom. */
export function PlateText({ top, kicker, title, meta, as = 'h2' }: { top?: ReactNode; kicker?: ReactNode; title: ReactNode; meta?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className="rp-text">
      <div className="rp-text__top">{top}</div>
      <div className="rp-text__foot">
        {kicker && <span className="rp-text__kicker">{kicker}</span>}
        <DisplayTitle as={as} size="md" className="rp-text__title">
          {title}
        </DisplayTitle>
        {meta && <span className="rp-text__meta">{meta}</span>}
      </div>
    </div>
  );
}

/** Round, status, flag + country, GP name and dates for a meeting plate. */
export function MeetingPlateText({ m, status, as }: { m: Meeting; status: MeetingStatus; as?: 'h1' | 'h2' }) {
  const meta = safeMeta(m.circuitId);
  return (
    <PlateText
      as={as}
      top={
        <>
          <span className="rp-text__round">
            {t('races.round', { n: m.round })}
            {m.sprint ? ` · ${t('scr.sprint')}` : ''}
          </span>
          {(status === 'LIVE' || status === 'NEXT') && <StatusPill status={status} />}
        </>
      }
      kicker={
        <>
          <Flag cc={m.countryCode} size={20} />
          {countryName(m.countryCode)}
        </>
      }
      title={meetingName(m)}
      meta={`${meetingDates(m)} · ${meta?.shortName ?? meta?.name ?? ''}`}
    />
  );
}
