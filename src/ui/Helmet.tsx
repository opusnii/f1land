import type { CSSProperties } from 'react';
import { helmetAsset } from '@/assets';
import { DRIVER_BY_ID, TEAM_BY_ID } from '@/data/teams';
import { Obj } from './Obj';

interface HelmetProps {
  /** Driver id (preferred): resolves team, number and accessible name. */
  driverId?: string | null;
  /** Team id when there is no driver (guest / team cards). */
  teamId?: string | null;
  size?: number;
  /** Race number plate; defaults to on from 40 px. */
  num?: boolean;
  /** Team-colour ring for the followed / selected driver. */
  ring?: boolean;
  className?: string;
  /** Decorative when a neighbouring label names the driver. */
  decorative?: boolean;
}

/** Team helmet render (group D) on a team-tinted disc; the number is HTML so it stays crisp and real. */
export function Helmet({ driverId, teamId, size = 40, num, ring, className, decorative }: HelmetProps) {
  const d = driverId ? DRIVER_BY_ID[driverId] : undefined;
  const team = teamId ?? d?.teamId ?? null;
  const color = team ? TEAM_BY_ID[team]?.color : undefined;
  const showNum = (num ?? size >= 40) && !!d;
  const style = { width: size, height: size, '--team': color ?? '#7d8a93' } as CSSProperties;
  const label = d ? `${d.firstName} ${d.lastName}` : undefined;
  return (
    <span
      className={`helmet${ring ? ' helmet--ring' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      role={decorative || !label ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <Obj name={helmetAsset(team)} size={Math.round(size * 0.94)} className="helmet__obj" />
      {showNum && (
        <span className="helmet__num num" aria-hidden="true">
          {d!.number}
        </span>
      )}
    </span>
  );
}
