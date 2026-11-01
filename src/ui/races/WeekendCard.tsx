import type { Meeting, MeetingStatus } from '@/data/calendar';
import { useNav } from '@/store/nav';
import { fmtClock, fmtDate, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { IconChevron, IconPlay } from '@/ui/icons';
import { MeetingPlateText, RacePlate } from './RacePlate';
import { channelFor, focusSession, sessState, startsIn, watchChannel } from './util';

/** The weekend's sessions as a track: done, live, next (lime) and still to come. */
function WeekendTimeline({ m, now }: { m: Meeting; now: number }) {
  const next = m.sessions.find((s) => sessState(s, now) !== 'done');
  return (
    <ol className="rc-tl" aria-label={t('races.sessions')}>
      {m.sessions.map((s) => {
        const at = Date.parse(s.startsAt);
        return (
          <li key={s.id} className="rc-tl__s" data-st={sessState(s, now)} data-next={s === next || undefined} aria-label={`${t(`session.${s.kind}`)}: ${fmtDate(at, { weekday: 'long' })}, ${fmtClock(at)}`}>
            <span className="rc-tl__k" aria-hidden="true">
              {t(`scr.sess.${s.kind}`)}
            </span>
            <span className="rc-tl__dot" aria-hidden="true" />
            <span className="rc-tl__d" aria-hidden="true">
              {fmtDate(at, { weekday: 'short' })}
            </span>
            <span className="rc-tl__t num" aria-hidden="true">
              {fmtClock(at)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "This weekend": circuit plate + neon track, the next session, the session timeline and the two actions. */
export function WeekendCard({ m, status, now }: { m: Meeting; status: MeetingStatus; now: number }) {
  const push = useNav((s) => s.push);
  const focus = focusSession(m, now);
  const ch = channelFor(m, focus?.s) ?? channelFor(m);
  const open = () => {
    haptic.tap();
    push({ name: 'meeting', meetingId: m.id });
  };
  return (
    <section className="rc-wk" aria-label={t('rv2.weekend')}>
      <RacePlate circuitId={m.circuitId} priority>
        <MeetingPlateText m={m} status={status} />
        {/* Pointer shortcut to the weekend; keyboard and screen readers use the "Weekend" button below. */}
        <button type="button" className="rp-hit" tabIndex={-1} aria-hidden="true" onClick={open} />
      </RacePlate>
      <div className="rc-wk__panel">
        {focus && (
          <div className="rc-wk__next">
            {focus.live ? (
              <b className="rc-wk__live">
                <span className="dot-live" aria-hidden="true" />
                {t('scr.races.liveNow', { s: t(`session.${focus.s.kind}`) })}
              </b>
            ) : (
              <>
                <b>{t(`session.${focus.s.kind}`)}</b>
                <span className="rc-wk__in num" role="timer">
                  {t('scr.races.in', { t: startsIn(Date.parse(focus.s.startsAt) - now) })}
                </span>
              </>
            )}
          </div>
        )}
        <WeekendTimeline m={m} now={now} />
        <div className="rc-actions rc-wk__actions">
          {ch && (
            <button className="btn btn--primary" onClick={() => watchChannel(ch)}>
              <IconPlay size={16} />
              {t('races.watchDemo')}
            </button>
          )}
          <button className="btn btn--ghost" onClick={open}>
            {t('scr.races.weekend')}
            <IconChevron size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
