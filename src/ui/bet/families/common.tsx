/* Shared pieces for the nine pool infographics (spec §9.3). */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useLive } from '@/store/live';
import type { LiveCar } from '@/sim/types';
import { DRIVER_BY_ID, TEAM_BY_ID } from '@/data/teams';
import { Helmet } from '@/ui/Helmet';
import '@/styles/pool/families.css';

/** Infographic panel (S1). One per pool screen; rows inside are flat, never nested cards. */
export function InfoCard({ title, aside, children, className = '' }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`pv card ${className}`}>
      {(title || aside) && (
        <header className="pv__head">
          {title && <h2 className="pv__t">{title}</h2>}
          {aside && <span className="pv__aside">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Helmet, race number, name and team; `right` holds the family's key figure. */
export function DriverStrip({ id, sub, right, size = 48 }: { id: string; sub?: ReactNode; right?: ReactNode; size?: number }) {
  const d = DRIVER_BY_ID[id];
  const team = d ? TEAM_BY_ID[d.teamId] : undefined;
  return (
    <div className="dstrip" style={{ '--team': team?.color ?? '#7d8a93' } as CSSProperties}>
      <Helmet driverId={id} size={size} ring decorative />
      <div className="dstrip__who">
        <b className="dstrip__name">
          {d ? `${d.firstName} ${d.lastName}` : id}
        </b>
        <span className="dstrip__sub">
          {d && <span className="dstrip__num num">#{d.number}</span>}
          <span>{sub ?? team?.shortName}</span>
        </span>
      </div>
      {right}
    </div>
  );
}

export interface CleanLap {
  driver: string;
  lap: number;
  ms: number;
}

/** Clean laps (valid, not pit in/out, not neutralised) from this session's event log. */
export function useCleanLaps(): CleanLap[] {
  const runner = useLive((s) => s.runner);
  const rev = useLive((s) => s.eventRev);
  const bucket = Math.floor(rev / 20);
  return useMemo(() => {
    if (!runner) return [];
    const out: CleanLap[] = [];
    for (const e of runner.events) {
      if (e.type !== 'LAP_COMPLETED') continue;
      const p = e.payload;
      if (!p.valid || p.pit_in_lap || p.pit_out_lap || p.neutralised) continue;
      out.push({ driver: p.driver_id, lap: p.driver_lap, ms: p.lap_time_ms });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, bucket]);
}

export const teamShort = (id: string): string => TEAM_BY_ID[DRIVER_BY_ID[id]?.teamId ?? '']?.shortName ?? '';

export function carById(cars: LiveCar[], id?: string | null): LiveCar | undefined {
  return id ? cars.find((c) => c.id === id) : undefined;
}
