import { useCallback, useMemo, useState } from 'react';
import { SEASON_2026, currentOrNextMeeting, meetingStatus, type Meeting } from '@/data/calendar';
import { CHANNELS, channelLaps, getChannel, type DemoChannel } from '@/demo/channels';
import { demoResults } from '@/demo/results';
import { DRIVER_BY_ID } from '@/data/teams';
import { useNav } from '@/store/nav';
import { useLive } from '@/store/live';
import { Header, SubHeader } from '@/app/Header';
import { Card, TeamBar, useNow } from '@/ui/kit';
import { Helmet } from '@/ui/Helmet';
import { Flag } from '@/ui/Obj';
import { IconCalendar, IconChevron, IconMap, IconPlay, IconTimer, IconUsers } from '@/ui/icons';
import { fmtLap, fmtNumber, getLang, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { MeetingPlateText, PlateText, RacePlate } from '@/ui/races/RacePlate';
import { WeekendCard } from '@/ui/races/WeekendCard';
import { RaceRow } from '@/ui/races/RaceRow';
import { KV, MeetingPools, ResultsList, SessionRow } from '@/ui/races/meeting';
import { watchChannel } from '@/ui/races/util';
import { CircuitThumb, Empty, PageHead, Reveal, meetingName, safeMeta, useBack, useCircuit } from './common';

export { channelFor, countryName, watchChannel } from '@/ui/races/util';

/* ------------------------------------------------------------------ */
/* Races tab                                                           */
/* ------------------------------------------------------------------ */

export function RacesScreen() {
  const now = useNow(1000);
  const push = useNav((s) => s.push);
  const [allResults, setAllResults] = useState(false);
  const minute = Math.floor(now / 60_000);
  const statuses = useMemo(() => new Map(SEASON_2026.map((m) => [m.id, meetingStatus(m, minute * 60_000 + 30_000)])), [minute]);
  const current = currentOrNextMeeting(now);
  const done = SEASON_2026.filter((m) => statuses.get(m.id) === 'COMPLETED').length;
  const ahead = SEASON_2026.filter((m) => m.round > current.round);
  const results = SEASON_2026.filter((m) => m.id !== current.id && statuses.get(m.id) === 'COMPLETED').reverse();
  const shown = allResults ? results : results.slice(0, 3);
  const open = useCallback((m: Meeting) => push({ name: 'meeting', meetingId: m.id }), [push]);

  return (
    <>
      <Header />
      <PageHead title={t('races.title')} sub={t('scr.races.season', { d: done, n: SEASON_2026.length })} />
      <WeekendCard m={current} status={statuses.get(current.id)!} now={now} />

      {ahead.length > 0 && (
        <section className="section rc-sec">
          <div className="section__head">
            <h2 className="section__title">{t('scr.races.ahead')}</h2>
          </div>
          <Card pad={false} className="rc-list">
            {ahead.map((m) => (
              <RaceRow key={m.id} m={m} status={statuses.get(m.id)!} onOpen={open} />
            ))}
          </Card>
        </section>
      )}

      {results.length > 0 && (
        <section className="section rc-sec">
          <div className="section__head">
            <h2 className="section__title">{t('races.results')}</h2>
          </div>
          <Card pad={false} className="rc-list">
            {shown.map((m) => (
              <RaceRow key={m.id} m={m} status="COMPLETED" onOpen={open} />
            ))}
            {results.length > 3 && (
              <button
                type="button"
                className="rc-more"
                aria-expanded={allResults}
                onClick={() => {
                  haptic.tap();
                  setAllResults(!allResults);
                }}
              >
                {allResults ? t('ui.collapse') : t('scr.races.allResults', { n: results.length })}
                <IconChevron size={14} dir={allResults ? 'up' : 'down'} />
              </button>
            )}
          </Card>
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Meeting                                                             */
/* ------------------------------------------------------------------ */

export function MeetingScreen({ meetingId }: { meetingId: string }) {
  const back = useBack();
  // Ids look like '2026-20'; a bare round number ('20') also resolves (deep links, dev tools).
  const m = SEASON_2026.find((x) => x.id === meetingId || String(x.round) === meetingId);
  if (!m) return <NotFound onBack={back} />;
  return <MeetingBody m={m} />;
}

function MeetingBody({ m }: { m: Meeting }) {
  const back = useBack();
  const push = useNav((s) => s.push);
  const now = useNow(1000);
  const status = meetingStatus(m, now);
  const meta = safeMeta(m.circuitId);
  const circuit = useCircuit(m.circuitId);
  const channels = CHANNELS.filter((c) => c.meetingRound === m.round);
  const activeId = useLive((s) => s.channelId);
  const loading = useLive((s) => s.loading);
  const activeHere = channels.find((c) => c.id === activeId);
  const results = status === 'COMPLETED' ? demoResults(m.id) : null;
  let i = 0;
  return (
    <>
      <SubHeader onBack={back} />
      <Reveal i={i++}>
        <RacePlate circuitId={m.circuitId} priority className="rc-mhero">
          <MeetingPlateText m={m} status={status} as="h1" />
        </RacePlate>
      </Reveal>

      <Reveal i={i++} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('races.sessions')}</h2>
          <span className="sc-note">{t('races.localTime')}</span>
        </div>
        <Card pad={false} className="rc-sess-list">
          {m.sessions.map((s) => (
            <SessionRow key={s.id} m={m} s={s} now={now} />
          ))}
        </Card>
      </Reveal>

      <Reveal i={i++} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('races.circuit')}</h2>
        </div>
        <Card onClick={() => push({ name: 'circuit', circuitId: m.circuitId })} ariaLabel={meta?.name ?? t('races.circuit')} className="rc-ccard">
          <div className="rc-ccard__top">
            <CircuitThumb id={m.circuitId} size={56} className="rc-ccard__track" />
            <div className="rc-ccard__txt">
              <div className="rc-ccard__name">{meta?.name}</div>
              <div className="rc-ccard__loc">
                <Flag cc={m.countryCode} size={16} />
                {meta?.location}, {meta?.country}
              </div>
              <span className="link-btn">
                <IconMap size={14} />
                {t('scr.circuit.open')}
              </span>
            </div>
            <IconChevron size={16} />
          </div>
          <div className="rc-kvgrid">
            <KV k={t('races.length')} v={meta ? `${fmtNumber(meta.lengthM / 1000, 3)} ${t('scr.km')}` : '—'} />
            <KV k={t('races.laps')} v={meta ? String(meta.laps) : '—'} />
            <KV k={t('races.record')} v={circuit?.lapRecordMs ? fmtLap(circuit.lapRecordMs) : '—'} tone="purple" />
            <KV k={t('races.direction')} v={meta ? t(meta.direction === 'CW' ? 'races.cw' : 'races.ccw') : '—'} text />
            <KV k={t('scr.circuit.turns')} v={circuit ? String(circuit.corners.length) : '—'} />
            <KV k={t('scr.circuit.distance')} v={meta ? `${fmtNumber((meta.lengthM * meta.laps) / 1000, 1)} ${t('scr.km')}` : '—'} />
          </div>
        </Card>
      </Reveal>

      <Reveal i={i++} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('races.pools')}</h2>
          {activeHere && <span className="sc-note">DEMO · {t(`session.${activeHere.sessionType}`)}</span>}
        </div>
        {activeHere ? (
          <MeetingPools channel={activeHere} />
        ) : channels.length ? (
          <Card>
            <Empty
              icon={<IconUsers size={24} />}
              title={t('scr.meeting.poolsDemo')}
              body={t('scr.meeting.poolsDemoSub')}
              action={
                <div className="sc-btnrow">
                  {channels.map((c) => (
                    <button
                      key={c.id}
                      className="btn btn--ghost btn--sm"
                      disabled={loading}
                      onClick={() => {
                        haptic.tap();
                        void useLive.getState().open(c.id);
                      }}
                    >
                      <IconPlay size={14} />
                      {t(`session.${c.sessionType}`)}
                    </button>
                  ))}
                </div>
              }
            />
          </Card>
        ) : (
          <Card>
            <Empty icon={<IconTimer size={24} />} title={t('races.noPools')} body={t('scr.meeting.noDemo')} />
          </Card>
        )}
      </Reveal>

      {results && (
        <Reveal i={i++} className="section rc-sec">
          <div className="section__head">
            <h2 className="section__title">{t('races.results')}</h2>
            <span className="sc-note">{t('session.GRAND_PRIX')}</span>
          </div>
          <ResultsList results={results} />
          <p className="sc-fine">{t('scr.demoResultsNote')}</p>
        </Reveal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Session (DEMO channel)                                              */
/* ------------------------------------------------------------------ */

export function SessionScreen({ channelId }: { channelId: string }) {
  const back = useBack();
  let ch: DemoChannel;
  try {
    ch = getChannel(channelId);
  } catch {
    return <NotFound onBack={back} />;
  }
  return <SessionBody ch={ch} />;
}

function SessionBody({ ch }: { ch: DemoChannel }) {
  const back = useBack();
  const push = useNav((s) => s.push);
  const lang = getLang();
  const circuit = useCircuit(ch.circuitId);
  const meta = safeMeta(ch.circuitId);
  const meeting = SEASON_2026.find((m) => m.round === ch.meetingRound);
  const activeId = useLive((s) => s.channelId);
  const live = useLive((s) => (s.channelId === ch.id ? s.live : null));
  const isActive = activeId === ch.id;
  const laps = meta ? channelLaps(ch, meta.laps, circuit?.sprintLaps) : null;
  const leader = live?.cars[0];
  const quali = ch.sessionType === 'QUALIFYING' || ch.sessionType === 'SPRINT_QUALIFYING';
  return (
    <>
      <SubHeader title={ch.title[lang]} onBack={back} />
      <Reveal i={0}>
        <section className="rc-wk">
          <RacePlate circuitId={ch.circuitId} priority>
            <PlateText
              as="h1"
              top={
                <>
                  <span className="rp-text__round">
                    <span className="sc-pill sc-pill--demo">DEMO</span>
                    {t(`session.${ch.sessionType}`)}
                  </span>
                  {isActive && live && <span className="badge badge--live">LIVE</span>}
                </>
              }
              kicker={
                <>
                  <Flag cc={meta?.countryCode} size={20} />
                  {meta?.name}
                </>
              }
              title={meeting ? meetingName(meeting) : ch.title[lang]}
            />
          </RacePlate>
          <div className="rc-wk__panel">
            <div className="rc-kvgrid">
              <KV k={quali ? t('scr.session.format') : t('races.laps')} v={quali ? (ch.sessionType === 'QUALIFYING' ? 'Q1·Q2·Q3' : 'SQ1·SQ2·SQ3') : String(laps ?? '—')} />
              <KV k={t('races.length')} v={meta ? `${fmtNumber(meta.lengthM / 1000, 3)} ${t('scr.km')}` : '—'} />
              <KV k={isActive && live ? t('scr.session.lap') : t('scr.session.status')} v={isActive && live ? `${live.leaderLap}/${live.totalLaps ?? '—'}` : t('scr.session.loop')} text={!(isActive && live)} />
            </div>
            {isActive && leader && (
              <div className="rc-leader">
                <span className="techlabel">P1</span>
                <TeamBar id={leader.id} />
                <Helmet driverId={leader.id} size={24} decorative />
                <b>{DRIVER_BY_ID[leader.id]?.code}</b>
                <span className="rc-leader__lap num">{fmtLap(leader.bestLapMs)}</span>
              </div>
            )}
            <p className="rc-about">{t('scr.session.about')}</p>
            <button className="btn btn--primary btn--block btn--lg" onClick={() => watchChannel(ch)}>
              <IconPlay size={18} />
              {isActive ? t('scr.session.backToLive') : t('scr.session.openLive')}
            </button>
          </div>
        </section>
      </Reveal>
      <Reveal i={1} className="section rc-sec rc-sec--tight">
        <div className="rc-actions">
          {meeting && (
            <button className="btn btn--ghost" onClick={() => push({ name: 'meeting', meetingId: meeting.id })}>
              <IconCalendar size={16} />
              {t('scr.races.weekend')}
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => push({ name: 'circuit', circuitId: ch.circuitId })}>
            <IconMap size={16} />
            {t('races.circuit')}
          </button>
        </div>
      </Reveal>
      <Reveal i={2} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('scr.session.others')}</h2>
        </div>
        <Card pad={false} className="rc-list">
          {CHANNELS.filter((c) => c.id !== ch.id).map((c) => (
            <button key={c.id} className="rc-ch" onClick={() => push({ name: 'session', channelId: c.id })}>
              <CircuitThumb id={c.circuitId} size={40} className="rc-row__track" />
              <span className="rc-ch__txt">
                <span>{c.title[lang]}</span>
                <span className="muted">{t(`session.${c.sessionType}`)}</span>
              </span>
              {c.id === activeId && <span className="dot-live" aria-label="LIVE" />}
              <IconChevron size={14} />
            </button>
          ))}
        </Card>
      </Reveal>
    </>
  );
}

export function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <>
      <SubHeader title={t('scr.notFound')} onBack={onBack} />
      <Card>
        <Empty icon={<IconMap size={24} />} title={t('scr.notFound')} body={t('scr.notFoundSub')} />
      </Card>
    </>
  );
}
