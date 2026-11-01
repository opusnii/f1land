/* Pool screen per market family (spec §9.3): outcome visuals, the outcome grid and the family infographic. */
import { useMemo, useState, type ReactNode } from 'react';
import { TYRE_OBJ } from '@/assets';
import { useLive } from '@/store/live';
import { multiplier, type LivePool } from '@/demo/poolEngine';
import type { Outcome, Pool } from '@/domain/types';
import type { LiveCar } from '@/sim/types';
import { fmtNumber, t } from '@/i18n/core';
import { driverCode, outcomeLabel, outcomeShort, type PoolLayout } from '@/app/poolText';
import { Helmet } from '@/ui/Helmet';
import { Obj } from '@/ui/Obj';
import { SECTOR_COLORS } from '@/ui/TrackMap';
import { OutcomeTile, type TileVariant } from './parts';
import { IcLink } from './icons';
import { SectorGlyph, sectorKm, teamColorOf } from './viz';
import { carById } from './families/common';
import { ZoneInfo } from './families/zone';
import { DuelInfo } from './families/duel';
import { PitInfo } from './families/pit';
import { TyreInfo } from './families/tyre';
import { PaceInfo } from './families/pace';
import { IncidentInfo } from './families/incident';
import { PositionInfo } from './families/position';
import { QualiInfo } from './families/quali';
import { ComboInfo } from './families/combo';

/* ------------------------------------------------------------------ */
/* Outcome visuals                                                     */
/* ------------------------------------------------------------------ */

type GlyphKind = 'yes' | 'no' | 'up' | 'down' | 'eq' | 'pass';
const GLYPH: Record<GlyphKind, string> = {
  yes: 'M5 12.5l4.5 4.5L19 7.5',
  no: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  up: 'M12 19V5.5M6 11l6-6 6 6',
  down: 'M12 5v13.5M6 13l6 6 6-6',
  eq: 'M5 9.5h14M5 14.5h14',
  pass: 'M5 6.5 10.5 12 5 17.5M12.5 6.5 18 12l-5.5 5.5',
};

/** Large stroked glyph (✓ ✕ ↑ ↓ = »): the outcome's meaning without an emoji. */
function Glyph({ kind, size }: { kind: GlyphKind; size: number }) {
  return (
    <svg className={`glyph glyph--${kind}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={GLYPH[kind]} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ZoneGlyph({ sector, size }: { sector: 1 | 2 | 3; size: number }) {
  const circuit = useLive((s) => s.runner?.circuit);
  if (!circuit) return <span className="zone-dot" style={{ background: SECTOR_COLORS[sector - 1] }} />;
  return <SectorGlyph circuit={circuit} sector={sector} width={Math.round(size * 1.7)} height={size} />;
}

const TYRES = new Set(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET']);

/** Visual for an outcome everywhere (tiles, ticket, confirmation, result): objects, helmets, sector outlines, big glyphs. */
export function outcomeIcon(o: Outcome, pool: Pick<Pool, 'market_id' | 'subject'>, size = 26): ReactNode {
  const id = o.id;
  const obj = (name: string) => <Obj name={name} size={size + 6} />;
  if (o.driver_id) return <Helmet driverId={o.driver_id} size={size + 4} num={false} decorative />;
  if (/^S[123]$/.test(id)) return <ZoneGlyph sector={Number(id[1]) as 1 | 2 | 3} size={size} />;
  if (id === 'PIT') return obj('pit-gun');
  if (TYRES.has(id)) return obj(TYRE_OBJ[id[0]!]!);
  if (id.startsWith('BUCKET_')) return obj('stopwatch');
  switch (id) {
    case 'SC':
      return obj('safety-car');
    case 'VSC':
      return obj('vsc-board');
    case 'RED':
      return obj('flag-red');
    case 'NONE':
      return obj(pool.market_id === 'F1-M12' ? 'flag-chequered' : 'flag-green');
    case 'RETIRED':
      return <Helmet teamId={null} size={size + 4} decorative />;
    case 'FASTER':
      return <Glyph kind="up" size={size} />;
    case 'SLOWER':
      return <Glyph kind="down" size={size} />;
    case 'EQUAL':
      return <Glyph kind="eq" size={size} />;
    case 'A_PASSES_B':
    case 'B_PASSES_A':
      return <Glyph kind="pass" size={size} />;
    case 'YES':
      return pool.market_id === 'F1-M14' ? obj('trophy-gold') : pool.market_id === 'F1-M20' ? obj('pit-gun') : <Glyph kind="yes" size={size} />;
    case 'NO':
    case 'NO_PASS':
    case 'NOT_BOTH':
      return <Glyph kind="no" size={size} />;
    case 'BOTH_TRUE':
      return <IcLink size={size - 4} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Outcome specs                                                       */
/* ------------------------------------------------------------------ */

interface TileSpec {
  o: Outcome;
  variant: TileVariant;
  label: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  color?: string;
  /** Secondary outcomes (statuses, “no event”) render in a compact list. */
  minor?: boolean;
}

const MINOR_IDS = new Set(['RETIRED', 'DNS', 'DSQ', 'NOT_CLASSIFIED', 'BOTH_INACTIVE', 'NO_VALID_LAP', 'NO_VALID_SECTOR', 'NEITHER_VALID', 'OTHER_CONFIRMED', 'NO_EXIT', 'NO_SERVICE', 'NO_VISIT', 'TIE', 'SIMULTANEOUS']);
const BUCKET_HINT: Record<string, string> = { BUCKET_1: 'pl.bucket.low', BUCKET_2: 'pl.bucket.mid', BUCKET_3: 'pl.bucket.high' };
const TILE_ICON = 34;

function specsFor(pool: Pool, layout: PoolLayout, km: number[]): TileSpec[] {
  const m = pool.market_id;
  const a = pool.subject.driver_a;
  const b = pool.subject.driver_b;
  return pool.outcomes.map((o): TileSpec => {
    const id = o.id;
    const minor = MINOR_IDS.has(id) || (m === 'F1-M03' && id === 'NO_ENTRY');
    const base: TileSpec = { o, variant: minor ? 'row' : 'tile', label: outcomeShort(o, pool), icon: outcomeIcon(o, pool, minor ? 22 : TILE_ICON), minor };
    if (minor) {
      const full = outcomeLabel(o, m);
      const code = full.match(/\(([A-Z]{2,4})\)$/)?.[1];
      return { ...base, label: full.replace(/\s*\([A-Z]{2,4}\)$/, ''), icon: code ? <span className="ot__code num">{code}</span> : base.icon };
    }
    if (layout === 'zone') {
      if (/^S[123]$/.test(id)) {
        const s = Number(id[1]);
        return { ...base, variant: 'zone', label: t('f1.outcome.sector', { sector: s }), sub: km[s - 1] ? t('pv2.kmShort', { km: fmtNumber(km[s - 1]!, 1) }) : undefined, color: SECTOR_COLORS[s - 1] };
      }
      return { ...base, variant: 'zone', label: t('pl.pitLane'), sub: t('pl.pitSub'), color: 'var(--cyan)' };
    }
    if (o.driver_id && (m === 'F1-M03' || m === 'F1-M09' || m === 'F1-M12' || m === 'F1-M17')) {
      return { ...base, variant: 'driver', label: driverCode(o.driver_id), icon: outcomeIcon(o, pool, 32), color: teamColorOf(o.driver_id) };
    }
    if (id === 'A_PASSES_B' || id === 'B_PASSES_A') return { ...base, color: teamColorOf(id === 'A_PASSES_B' ? a : b), sub: t('pl.sub.passes') };
    if (m === 'F1-M02' && (id === 'A' || id === 'B')) return { ...base, sub: t('pl.sub.ahead'), color: teamColorOf(o.driver_id) };
    if (m === 'F1-M16' && (id === 'A' || id === 'B')) return { ...base, sub: t('pl.sub.faster'), color: teamColorOf(o.driver_id) };
    if (id === 'NO_PASS') return { ...base, sub: t('pl.sub.noPass') };
    if (id.startsWith('BUCKET_')) return { ...base, sub: t(BUCKET_HINT[id]!) };
    if (TYRES.has(id)) return { ...base, sub: undefined };
    if (m === 'F1-M08' && ['FASTER', 'EQUAL', 'SLOWER'].includes(id)) return { ...base, sub: t('pl.sub.vsRef') };
    if (m === 'F1-M10') return { ...base, label: id === 'NONE' ? t('pl.short.none') : id === 'RED' ? t('pl.short.red') : id === 'SC' ? 'Safety Car' : 'Virtual SC', sub: id === 'NONE' ? t('pl.sub.noNeutral') : t('pl.sub.nextOnTrack') };
    if (m === 'F1-M12' && id === 'NONE') return { ...base, variant: 'wide', label: outcomeLabel(o, m), sub: t('pl.sub.window') };
    if (m === 'F1-M01' && /^P\d+$/.test(id)) return { ...base, variant: 'num', icon: undefined };
    if ((m === 'F1-M13' || m === 'F1-M18') && !minor) return { ...base, sub: t(`pl.group.${id.toLowerCase()}`), icon: <span className="grp-ico num">{id === 'P1' ? 'P1' : id.replace('P', '').replace('_PLUS', '+').replace('_', '–')}</span> };
    if (id === 'YES' || id === 'NO') {
      const subKey = m === 'F1-M14' ? (id === 'YES' ? 'pl.sub.podiumYes' : 'pl.sub.podiumNo') : m === 'F1-M15' ? (id === 'YES' ? 'pl.sub.progressYes' : 'pl.sub.progressNo') : m === 'F1-M20' ? (id === 'YES' ? 'pl.sub.changeYes' : 'pl.sub.changeNo') : undefined;
      return { ...base, sub: subKey ? t(subKey) : undefined };
    }
    if (id === 'BOTH_TRUE' || id === 'NOT_BOTH') return { ...base, sub: id === 'BOTH_TRUE' ? t('pl.sub.bothTrue') : t('pl.sub.notBoth') };
    return base;
  });
}

/* ------------------------------------------------------------------ */
/* Outcome grid                                                        */
/* ------------------------------------------------------------------ */

export function OutcomeGrid({
  lp,
  layout,
  value,
  onChange,
  disabled,
  stake,
  myPicks,
}: {
  lp: LivePool;
  layout: PoolLayout;
  value: string | null;
  onChange: (id: string) => void;
  disabled: boolean;
  stake: number;
  myPicks: Set<string>;
}) {
  const pool = lp.pool;
  const circuit = useLive((s) => s.runner?.circuit);
  const live = useLive((s) => s.live);
  const [showAll, setShowAll] = useState(false);
  const km = useMemo(() => sectorKm(circuit), [circuit]);
  const specs = specsFor(pool, layout, km);
  const locked = pool.status !== 'OPEN';
  const settled = pool.status === 'SETTLED' || pool.status === 'VOID';
  const winner = pool.status === 'SETTLED' ? (pool.settlement?.winner_outcome_id ?? null) : null;
  const oddsOf = (id: string) => (locked && lp.book.finalMultipliers?.[id] ? lp.book.finalMultipliers[id]! : multiplier(lp.book, id, value === id ? stake : 0));
  const bookTotal = Object.values(lp.book.stakes).reduce((x, y) => x + y, 0);
  const shareOf = (id: string) => (bookTotal > 0 ? (lp.book.stakes[id] ?? 0) / bookTotal : null);
  const tile = (s: TileSpec) => (
    <OutcomeTile
      key={s.o.id}
      variant={s.variant}
      label={s.label}
      sub={s.sub}
      icon={s.icon}
      color={s.color}
      odds={oddsOf(s.o.id)}
      share={s.variant === 'row' ? null : shareOf(s.o.id)}
      checked={value === s.o.id}
      disabled={disabled}
      locked={disabled && !settled}
      mine={myPicks.has(s.o.id)}
      result={winner ? (winner === s.o.id ? 'win' : 'lose') : null}
      ariaLabel={`${outcomeLabel(s.o, pool.market_id)} · ${oddsOf(s.o.id).toFixed(2)}x`}
      onSelect={() => onChange(s.o.id)}
    />
  );

  const major = specs.filter((s) => !s.minor);
  const minor = specs.filter((s) => s.minor);
  const drivers = major.filter((s) => s.variant === 'driver');
  const others = major.filter((s) => s.variant !== 'driver');

  // Driver lists: focus drivers first, then the crowd favourites; collapsed after 9.
  let driverList = drivers;
  if (drivers.length) {
    const focus = new Set(lp.focus);
    const posOf = (id?: string) => live?.cars.find((c) => c.id === id)?.position ?? 99;
    driverList = [...drivers].sort((x, y) => Number(focus.has(y.o.driver_id!)) - Number(focus.has(x.o.driver_id!)) || oddsOf(x.o.id) - oddsOf(y.o.id) || posOf(x.o.driver_id) - posOf(y.o.driver_id));
    if (value && !showAll) {
      const i = driverList.findIndex((s) => s.o.id === value);
      if (i >= 9) driverList = [driverList[i]!, ...driverList.filter((_, k) => k !== i)];
    }
  }
  const visibleDrivers = showAll ? driverList : driverList.slice(0, 9);
  const nums = others.filter((s) => s.variant === 'num');
  const wide = others.filter((s) => s.variant === 'wide');
  const rest = others.filter((s) => s.variant !== 'num' && s.variant !== 'wide');
  const cols = rest.length === 1 ? 1 : rest.length === 2 || rest.length === 4 ? 2 : 3;

  return (
    <div className={`og ${value ? 'og--has-sel' : ''}`} role="radiogroup" aria-label={t('pool.choose')}>
      {rest.length > 0 && (
        <div className={`og__grid og__grid--${layout}`} style={{ ['--cols' as string]: String(cols) }}>
          {rest.map(tile)}
        </div>
      )}
      {wide.length > 0 && <div className="og__wide">{wide.map(tile)}</div>}
      {nums.length > 0 && <div className="og__nums">{[...nums].sort((x, y) => Number(x.o.id.slice(1)) - Number(y.o.id.slice(1))).map(tile)}</div>}
      {visibleDrivers.length > 0 && (
        <>
          <div className="og__drivers">{visibleDrivers.map(tile)}</div>
          {driverList.length > 9 && (
            <button type="button" className="og__more" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
              {showAll ? t('ui.collapse') : t('pl.showAll', { n: driverList.length })}
            </button>
          )}
        </>
      )}
      {minor.length > 0 && (
        <>
          <div className="og__minor-k">{t('pl.otherOutcomes')}</div>
          <div className="og__minor">{minor.map(tile)}</div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Family infographic                                                  */
/* ------------------------------------------------------------------ */

export function FamilyVisual({ lp, layout }: { lp: LivePool; layout: PoolLayout }) {
  const live = useLive((s) => s.live);
  const pool = lp.pool;
  const cars = live?.cars ?? [];
  const a = carById(cars, pool.subject.driver_a);
  const b = carById(cars, pool.subject.driver_b);
  switch (layout) {
    case 'zone':
      return a ? <ZoneInfo car={a} poolId={pool.pool_id} /> : null;
    case 'duel':
      return pool.subject.driver_a && pool.subject.driver_b ? <DuelInfo a={pool.subject.driver_a} b={pool.subject.driver_b} ca={a} cb={b} quali={pool.market_id === 'F1-M16'} /> : null;
    case 'pit':
      return <PitInfo pool={pool} car={a} focus={lp.focus} cars={cars} />;
    case 'tyre':
      return a ? <TyreInfo car={a} cars={cars} totalLaps={live?.totalLaps ?? null} /> : null;
    case 'pace':
      return <PaceInfo pool={pool} car={a} />;
    case 'incident':
      return <IncidentInfo />;
    case 'position':
      return a ? <PositionInfo pool={pool} car={a} cars={cars} /> : null;
    case 'quali':
      return <QualiInfo pool={pool} />;
    case 'combo':
      return <ComboInfo lp={lp} cars={cars} />;
    default:
      return null;
  }
}

/** Live context chip for the scene HUD (e.g. gap in a duel). */
export function sceneChip(pool: Pool, cars: LiveCar[]): string | null {
  const a = cars.find((c) => c.id === pool.subject.driver_a);
  if (!a) return null;
  return `${driverCode(a.id)} · P${a.position}${a.occupancy === 'ON_TRACK' ? ` · S${a.sector}` : ''}`;
}

export function fmtPulse(n: number): string {
  return `${fmtNumber(n)} PULSE`;
}
