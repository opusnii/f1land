import { memo } from 'react';
import type { Meeting, MeetingStatus } from '@/data/calendar';
import { DRIVER_BY_ID } from '@/data/teams';
import { demoResults } from '@/demo/results';
import { fmtClock, fmtDate, getLang, t } from '@/i18n/core';
import { Helmet } from '@/ui/Helmet';
import { Flag } from '@/ui/Obj';
import { CircuitThumb, meetingDates, meetingName, safeMeta } from '@/screens/common';
import { countryName } from './util';

function monthShort(month: number): string {
  return new Intl.DateTimeFormat(getLang(), { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, month - 1, 15)).replace('.', '');
}

/** Calendar-style date chip from the meeting's local on-track days. */
function DateBlock({ m }: { m: Meeting }) {
  const [, m1, d1] = m.startDate.split('-').map(Number) as [number, number, number];
  const [, m2, d2] = m.endDate.split('-').map(Number) as [number, number, number];
  return (
    <span className="rc-date" aria-hidden="true">
      <b className="num">
        {d1}–{d2}
      </b>
      <small>{m1 === m2 ? monthShort(m1) : `${monthShort(m1)}–${monthShort(m2)}`}</small>
    </span>
  );
}

/** Calendar row: date chip, flag + country, venue and race time or the podium with helmets, small circuit outline. */
export const RaceRow = memo(function RaceRow({ m, status, onOpen }: { m: Meeting; status: MeetingStatus; onOpen: (m: Meeting) => void }) {
  const meta = safeMeta(m.circuitId);
  const podium = status === 'COMPLETED' ? demoResults(m.id).filter((r) => !r.dnf).slice(0, 3) : null;
  const race = m.sessions.find((s) => s.kind === 'GRAND_PRIX');
  const raceAt = race ? Date.parse(race.startsAt) : null;
  return (
    <button type="button" className="rc-row" onClick={() => onOpen(m)} aria-label={`${t('races.round', { n: m.round })}. ${meetingName(m)}, ${meetingDates(m)}`}>
      <DateBlock m={m} />
      <span className="rc-row__main">
        <span className="rc-row__name">
          <Flag cc={m.countryCode} size={18} />
          <span className="rc-row__cc">{countryName(m.countryCode)}</span>
        </span>
        {podium ? (
          <span className="rc-pod">
            {podium.map((r) => (
              <span key={r.driverId} className="rc-pod__d" data-pos={r.pos}>
                <Helmet driverId={r.driverId} size={18} decorative />
                {DRIVER_BY_ID[r.driverId]?.code}
              </span>
            ))}
          </span>
        ) : (
          <span className="rc-row__meta">
            {meta?.shortName}
            {raceAt !== null && (
              <>
                {' · '}
                <span className="rc-row__when">
                  <span className="rc-row__k">{t('session.GRAND_PRIX')} </span>
                  {fmtDate(raceAt, { weekday: 'short' })} {fmtClock(raceAt)}
                </span>
              </>
            )}
            {m.sprint ? ` · ${t('scr.sprint')}` : ''}
          </span>
        )}
      </span>
      <CircuitThumb id={m.circuitId} size={40} className="rc-row__track" />
    </button>
  );
});
