/* Pool mechanic identity shared by Home and the Live drawer: duotone icon, display name, outcome mini-visual. */
import type { ReactNode } from 'react';
import type { Outcome, Pool } from '@/domain/types';
import type { PoolLayout } from '@/app/poolText';
import { TYRE_OBJ } from '@/assets';
import { t } from '@/i18n/core';
import { Obj } from '@/ui/Obj';
import { Helmet } from '@/ui/Helmet';
import { SECTOR_COLORS } from '@/ui/TrackMap';

/** Filled parts carry `currentColor` at 18 % (spec §5 duotone); strokes stay full colour. */
const DUO = { fill: 'currentColor', fillOpacity: 0.18 } as const;

const GLYPH: Record<PoolLayout, ReactNode> = {
  zone: (
    <>
      <circle cx="12" cy="12" r="8.5" {...DUO} />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  position: (
    <>
      <path d="M9 20.5V9.5h6v11zM3 20.5v-6h6v6zM15 20.5v-8h6v8z" {...DUO} />
      <path d="M2 20.5h20M12 3.2l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" />
    </>
  ),
  duel: (
    <>
      <path d="M3 4.5 12 12l-9 7.5z" {...DUO} />
      <path d="M21 4.5 12 12l9 7.5z" {...DUO} />
    </>
  ),
  pit: <path d="M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8a1.9 1.9 0 0 0 2.7 2.7l6.4-6.4a5 5 0 0 0 6.9-4.6l-3 3-2.8-.6-.6-2.8z" {...DUO} />,
  tyre: (
    <>
      <circle cx="12" cy="12" r="8.5" {...DUO} />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" strokeWidth={1.2} />
    </>
  ),
  pace: (
    <>
      <circle cx="12" cy="13.5" r="7.5" {...DUO} />
      <path d="M12 9.5v4l2.5 1.6M9.5 2.5h5M12 2.5V6M18.5 6.5l1.5-1.5" />
    </>
  ),
  incident: (
    <>
      <path d="M5.5 4.5h12l-2.5 4 2.5 4h-12z" {...DUO} />
      <path d="M5.5 3v18" />
    </>
  ),
  quali: (
    <>
      <rect x="3.5" y="4" width="17" height="4" rx="1.4" {...DUO} />
      <rect x="3.5" y="10" width="12" height="4" rx="1.4" {...DUO} />
      <path d="M3 17.5h18" strokeDasharray="2 2.4" />
      <path d="M3.5 21h8" />
    </>
  ),
  combo: (
    <>
      <circle cx="5.5" cy="6" r="2.5" {...DUO} />
      <circle cx="18.5" cy="12" r="2.5" {...DUO} />
      <circle cx="5.5" cy="18" r="2.5" {...DUO} />
      <path d="M8 6.8 16 11M16 13l-8 4.2" />
    </>
  ),
};

export function MechIcon({ family, size = 20, className }: { family: PoolLayout; size?: number; className?: string }) {
  return (
    <svg className={`mech-icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPH[family]}
    </svg>
  );
}

export function mechName(family: PoolLayout): string {
  return t(`hl.mech.${family}`);
}

const TYRE_LETTER: Record<string, string> = { SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W' };
const STATUS_OBJ: Record<string, string> = { SC: 'safety-car', VSC: 'vsc-board', RED: 'flag-red', NONE: 'flag-green', PIT: 'pit-gun' };
const PODIUM_OBJ: Record<string, string> = { P1: 'trophy-gold', P1_3: 'trophy-silver', P2_3: 'trophy-silver' };

function SectorGlyph({ s, size }: { s: 1 | 2 | 3; size: number }) {
  const c = SECTOR_COLORS[s - 1]!;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 17c2.5-7 6-10 9-10s5 2 7 5" stroke="rgba(255,255,255,.18)" strokeWidth={4} strokeLinecap="round" />
      <path d={s === 1 ? 'M4 17c1.2-3.4 2.7-6 4.4-7.6' : s === 2 ? 'M8.4 9.4C10 8 11.5 7 13 7s2.4.4 3.4 1.2' : 'M16.4 8.2c1.3 1 2.5 2.3 3.6 3.8'} stroke={c} strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

function YesNoGlyph({ yes, size }: { yes: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" {...DUO} strokeWidth={1.5} />
      {yes ? <path d="m8 12.5 2.8 2.8L16.5 9" /> : <path d="m9 9 6 6M15 9l-6 6" />}
    </svg>
  );
}

/** Object or mini-visual for an outcome tile (spec §9.1 / §9.3). Null when nothing honest fits. */
export function outcomeVisual(o: Outcome, pool: Pick<Pool, 'subject'>, size = 28): ReactNode {
  const id = o.id;
  const a = pool.subject.driver_a;
  const b = pool.subject.driver_b;
  if (o.driver_id) return <Helmet driverId={o.driver_id} size={size} num={false} decorative />;
  if (id === 'A_PASSES_B' && a) return <Helmet driverId={a} size={size} num={false} decorative />;
  if (id === 'B_PASSES_A' && b) return <Helmet driverId={b} size={size} num={false} decorative />;
  if (/^S[123]$/.test(id)) return <SectorGlyph s={Number(id[1]) as 1 | 2 | 3} size={size} />;
  if (TYRE_LETTER[id]) return <Obj name={TYRE_OBJ[TYRE_LETTER[id]!]!} size={size} />;
  if (STATUS_OBJ[id]) return <Obj name={STATUS_OBJ[id]!} size={size} />;
  if (PODIUM_OBJ[id]) return <Obj name={PODIUM_OBJ[id]!} size={size} />;
  if (id.startsWith('BUCKET_')) return <Obj name="stopwatch" size={size} />;
  if (id === 'YES' || id === 'NO') return <YesNoGlyph yes={id === 'YES'} size={size - 4} />;
  return null;
}
