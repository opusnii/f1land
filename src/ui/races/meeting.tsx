import { useState } from 'react';
import type { CalendarSession, Meeting } from '@/data/calendar';
import { DRIVER_BY_ID } from '@/data/teams';
import type { DemoChannel } from '@/demo/channels';
import { usePools, multiplier, type LivePool } from '@/demo/poolEngine';
import type { demoResults } from '@/demo/results';
import { previousStart } from '@/demo/schedule';
import { useNav } from '@/store/nav';
import { useLive } from '@/store/live';
import { useSessionNow } from '@/app/hooks';
import { poolTexts } from '@/app/poolText';
import { msUntilLock } from '@/domain/lifecycle';
import { fmtClock, fmtCountdown, fmtDate, fmtDuration, fmtGap, fmtNumber, fmtOdds, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { Card, TeamBar } from '@/ui/kit';
import { Helmet } from '@/ui/Helmet';
import { IconCheck, IconChevron, IconPlay, IconTimer, IconUsers } from '@/ui/icons';
import { Empty } from '@/screens/common';
import { channelFor, sessState, watchChannel } from './util';

/** Key/value S2 tile (facts under a hero, session format). */
export function KV({ k, v, tone, text }: { k: string; v: string; tone?: string; text?: boolean }) {
  return (
    <div className="rc-kv">
      <span className={`rc-kv__v ${text ? 'rc-kv__v--txt' : 'num'} ${tone ?? ''}`}>{v}</span>
      <span className="rc-kv__k">{k}</span>
    </div>
  );
}

export function SessionRow({ m, s, now }: { m: Meeting; s: CalendarSession; now: number }) {
  const st = sessState(s, now);
  const start = Date.parse(s.startsAt);
  const end = Date.parse(s.endsAt);
  const prev = previousStart(s.id);
  const ch = channelFor(m, s);
  const major = s.kind === 'GRAND_PRIX' || s.kind === 'SPRINT';
  return (
    <div className="rc-sess" data-st={st} data-major={major || undefined}>
      <div className="rc-sess__day">
        <span>{fmtDate(start, { weekday: 'short' })}</span>
        <b className="num">{new Date(start).getDate()}</b>
      </div>
      <div className="rc-sess__main">
        <div className="rc-sess__name">{t(`session.${s.kind}`)}</div>
        <div className="rc-sess__time num">
          {fmtClock(start)}–{fmtClock(end)}
        </div>
        {prev && (
          <div className="rc-sess__resched">
            <span className="badge badge--yellow">{t('races.rescheduled')}</span>
            <s className="muted">{t('races.wasAt', { time: fmtClock(Date.parse(prev)) })}</s>
          </div>
        )}
      </div>
      <div className="rc-sess__right">
        {st === 'done' && (
          <span className="rc-sess__done">
            <IconCheck size={14} />
            {t('session.status.FINISHED')}
          </span>
        )}
        {st === 'live' && <span className="badge badge--live">LIVE</span>}
        {st === 'upcoming' && <span className="rc-sess__in num">{t('scr.in', { d: start - now < 86_400_000 ? fmtCountdown(start - now) : fmtDuration(start - now) })}</span>}
        {ch && (
          <button className="rc-sess__watch" onClick={() => watchChannel(ch)} aria-label={`${t('races.watchDemo')}: ${t(`session.${s.kind}`)}`}>
            <IconPlay size={12} />
            DEMO
          </button>
        )}
      </div>
    </div>
  );
}

export function MeetingPools({ channel }: { channel: DemoChannel }) {
  const pools = usePools((s) => s.pools);
  const push = useNav((s) => s.push);
  const loading = useLive((s) => s.loading);
  const now = useSessionNow();
  const open = pools.filter((p) => p.pool.status === 'OPEN').sort((a, b) => b.priority - a.priority);
  if (!open.length)
    return (
      <Card>
        <Empty
          icon={<IconTimer size={24} />}
          title={loading ? t('ui.syncing') : t('races.noPools')}
          action={
            <button className="btn btn--ghost btn--sm" onClick={() => watchChannel(channel)}>
              <IconPlay size={14} />
              {t('races.watchDemo')}
            </button>
          }
        />
      </Card>
    );
  return (
    <div className="rc-pools">
      {open.slice(0, 6).map((lp) => (
        <PoolRow key={lp.pool.pool_id} lp={lp} now={now} onOpen={() => push({ name: 'pool', channelId: channel.id, poolId: lp.pool.pool_id })} />
      ))}
    </div>
  );
}

function PoolRow({ lp, now, onOpen }: { lp: LivePool; now: number; onOpen: () => void }) {
  const tx = poolTexts(lp.pool);
  // Outcomes nobody has backed yet report the 50× cap; keep the range to priced outcomes.
  const xs = lp.pool.outcomes.map((o) => multiplier(lp.book, o.id)).filter((x) => x < 50);
  const lo = xs.length ? Math.min(...xs) : null;
  const hi = xs.length ? Math.max(...xs) : null;
  const ms = msUntilLock(lp.pool, now);
  return (
    <Card onClick={onOpen} ariaLabel={tx.question} className="rc-pool">
      <div className="rc-pool__top">
        <span className="rc-pool__fam">{tx.title}</span>
        <span className="rc-pool__lock num">
          <IconTimer size={12} />
          {fmtCountdown(ms)}
        </span>
      </div>
      <div className="rc-pool__q">{tx.question}</div>
      <div className="rc-pool__foot">
        <span className="muted">
          <IconUsers size={12} /> {t('ui.joined', { n: fmtNumber(lp.book.players) })}
        </span>
        {lo !== null && hi !== null && <span className="rc-pool__x num">{lo === hi ? `×${fmtOdds(lo)}` : `×${fmtOdds(lo)}–${fmtOdds(hi)}`}</span>}
      </div>
    </Card>
  );
}

/** Classified order (DEMO results): position, team stripe, helmet, code + name, gap, points. */
export function ResultsList({ results }: { results: ReturnType<typeof demoResults> }) {
  const push = useNav((s) => s.push);
  const [showAll, setShowAll] = useState(false);
  return (
    <Card pad={false} className="rc-results">
      {(showAll ? results : results.slice(0, 10)).map((r) => {
        const d = DRIVER_BY_ID[r.driverId];
        return (
          <button key={r.driverId} className="rc-res" data-pos={r.pos} onClick={() => push({ name: 'driver', driverId: r.driverId })}>
            <span className="rc-res__pos num">{r.dnf ? 'DNF' : r.pos}</span>
            <TeamBar id={r.driverId} />
            <Helmet driverId={r.driverId} size={24} decorative />
            <span className="rc-res__name">
              <span className="rc-res__code">
                <b>{d?.code}</b>
                {r.fastestLap && <span className="rc-res__fl">{t('scr.fl')}</span>}
              </span>
              <span className="muted">{d?.lastName ?? r.driverId}</span>
            </span>
            <span className="rc-res__gap num">{r.pos === 1 ? t('scr.winner') : r.dnf ? '—' : r.lapsDown ? t('scr.lapsDown', { n: r.lapsDown }) : fmtGap(r.gapMs, 3)}</span>
            <span className="rc-res__pts num">{r.points ? `+${r.points}` : ''}</span>
          </button>
        );
      })}
      <button
        className="rc-res__more"
        aria-expanded={showAll}
        onClick={() => {
          haptic.tap();
          setShowAll(!showAll);
        }}
      >
        {showAll ? t('ui.collapse') : t('scr.meeting.fullResults')}
        <IconChevron size={14} dir={showAll ? 'up' : 'down'} />
      </button>
    </Card>
  );
}
