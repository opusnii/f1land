/* Incident (F1-M10/M12): current track status and this session's race-control log as a timeline. */
import type { ReactNode } from 'react';
import { useLive } from '@/store/live';
import type { Moment } from '@/sim/types';
import { t } from '@/i18n/core';
import { Helmet } from '@/ui/Helmet';
import { Obj } from '@/ui/Obj';
import { IconWarning } from '@/ui/icons';
import { momentText } from '../livePanels';
import { EventTimeline, type TimelineItem } from '../viz';
import { InfoCard } from './common';

const RC_KINDS = new Set<Moment['kind']>(['SC', 'VSC', 'RED', 'GREEN', 'RETIREMENT', 'TRACK_LIMITS']);
const TONE: Partial<Record<Moment['kind'], string>> = { SC: 'var(--yellow)', VSC: 'var(--yellow)', TRACK_LIMITS: 'var(--yellow)', RED: 'var(--red)', GREEN: 'var(--green)', RETIREMENT: 'var(--orange)' };

function badge(m: Moment): ReactNode {
  switch (m.kind) {
    case 'SC':
      return <Obj name="safety-car" size={30} />;
    case 'VSC':
      return <Obj name="vsc-board" size={30} />;
    case 'RED':
      return <Obj name="flag-red" size={30} />;
    case 'GREEN':
      return <Obj name="flag-green" size={30} />;
    case 'RETIREMENT':
      return <Helmet driverId={m.drivers[0] ?? null} size={30} num={false} decorative />;
    default:
      return <IconWarning size={16} />;
  }
}

export function trackStateObj(state: string): string {
  return state === 'RED' ? 'flag-red' : state.startsWith('SC') ? 'safety-car' : state.startsWith('VSC') ? 'vsc-board' : 'flag-green';
}

export function IncidentInfo() {
  const live = useLive((s) => s.live);
  if (!live) return null;
  const items: TimelineItem[] = live.moments
    .filter((m) => RC_KINDS.has(m.kind))
    .slice(-5)
    .reverse()
    .map((m) => ({ id: m.id, lap: m.lap, badge: badge(m), text: momentText(m), tone: TONE[m.kind] }));
  const left = live.totalLaps ? Math.max(0, live.totalLaps - live.leaderLap) : null;
  return (
    <InfoCard className="incinfo">
      <div className="incinfo__state">
        <Obj name={trackStateObj(live.trackState)} size={44} />
        <span className="incinfo__state-t">
          <small className="techlabel">{t('pv2.trackNow')}</small>
          <b>{t(`rc.${live.trackState}`)}</b>
        </span>
        {left !== null && (
          <span className="incinfo__left">
            <b className="num">{left}</b>
            <small>{t('pv2.lapsLeft')}</small>
          </span>
        )}
      </div>
      <span className="pv-label">{t('pv2.rcLog')}</span>
      <EventTimeline items={items} empty={t('pv2.noIncidents')} />
    </InfoCard>
  );
}
