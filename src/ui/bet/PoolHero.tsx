/* Pool hero (spec §9.3 item 2, §7.3): mechanic plate, or circuit plate + neon track for zone / pit / position.
   The 3D scene is opt-in from the hero corner; positions on any map are approximate (SRS). */
import { memo, useMemo } from 'react';
import { circuitPlate, poolPlate } from '@/assets';
import { useLive } from '@/store/live';
import { useMapCars } from '@/app/hooks';
import { multiplier, type LivePool } from '@/demo/poolEngine';
import type { CircuitData } from '@/data/circuits/types';
import { makeSvgProjector, polylineToSvgPath } from '@/data/circuits/geometry';
import { driverCode, type PoolLayout } from '@/app/poolText';
import { fmtGap, fmtNumber, fmtOdds, t } from '@/i18n/core';
import { HeroPlate, Tagline } from '@/ui/primitives';
import { TrackMap, type MapCar } from '@/ui/TrackMap';
import { IconLayers, IconMap } from '@/ui/icons';
import { haptic } from '@/telegram/sdk';
import { sectorKm, useBoxSize } from './viz';
import '@/styles/pool/hero.css';

const TRACK_FAMILIES = new Set<PoolLayout>(['zone', 'pit', 'position']);
const TAGLINE: Partial<Record<PoolLayout, string>> = { zone: 'tag.zone', incident: 'tag.incident' };
export const HERO_H = 220;

interface Props {
  lp: LivePool;
  layout: PoolLayout;
  outcome: string | null;
  accept: boolean;
  onPickSector: (s: 1 | 2 | 3) => void;
  mode3d: boolean;
  can3d: boolean;
  onToggle3d: () => void;
}

export function PoolHero({ lp, layout, outcome, accept, onPickSector, mode3d, can3d, onToggle3d }: Props) {
  const circuit = useLive((s) => s.runner?.circuit ?? null);
  const totalLaps = useLive((s) => s.live?.totalLaps ?? null);
  const leaderLap = useLive((s) => s.live?.leaderLap ?? 0);
  const segment = useLive((s) => s.live?.segment?.id ?? null);
  const track = TRACK_FAMILIES.has(layout) && !!circuit;
  const tag = TAGLINE[layout];

  const hud = (
    <>
      <div className="pl-hud pl-hud--tl">
        <span className="pl-hud__live techlabel">
          <i aria-hidden="true" /> LIVE
        </span>
        {totalLaps ? (
          <span className="num">
            {t('lv.lapShort')} <b>{Math.min(leaderLap, totalLaps)}</b>/{totalLaps}
          </span>
        ) : segment ? (
          <span className="num">{segment}</span>
        ) : null}
      </div>
      {can3d && (
        <button
          type="button"
          className="pl-hero__view"
          aria-pressed={mode3d}
          onClick={() => {
            haptic.tap();
            onToggle3d();
          }}
        >
          {mode3d ? <IconMap size={16} /> : <IconLayers size={16} />}
          <span>{mode3d ? t('sys.view2d') : t('sys.view3d')}</span>
        </button>
      )}
      {circuit && (
        <div className="pl-hud pl-hud--bl">
          <b>{t('pv2.circuit', { name: circuit.shortName, km: fmtNumber(circuit.lengthM / 1000, 3) })}</b>
          {(track || mode3d) && <small>{t('sys.approx')}</small>}
        </div>
      )}
      {tag && !mode3d && <Tagline className="pl-hero__tag">{t(tag)}</Tagline>}
    </>
  );

  if (mode3d) {
    // Transparent window: the persistent scene host (layout 'top') shows through.
    return (
      <section className="pl-hero pl-hero--3d" aria-label={t('sys.view3d')}>
        {hud}
      </section>
    );
  }
  return (
    <HeroPlate
      art={track ? circuitPlate(circuit!.id) : poolPlate(layout)}
      height={HERO_H}
      scrim={track ? 'full' : 'l'}
      focal={track ? '50% 50%' : '72% 50%'}
      priority
      className={`pl-hero pl-hero--${layout}`}
      layer={track ? <HeroTrack circuit={circuit!} lp={lp} layout={layout} outcome={outcome} accept={accept} onPickSector={onPickSector} /> : undefined}
    >
      {hud}
    </HeroPlate>
  );
}

const HeroTrack = memo(function HeroTrack({ circuit, lp, layout, outcome, accept, onPickSector }: { circuit: CircuitData; lp: LivePool; layout: PoolLayout; outcome: string | null; accept: boolean; onPickSector: (s: 1 | 2 | 3) => void }) {
  const [ref, w, h] = useBoxSize<HTMLDivElement>(358, 150);
  const live = useLive((s) => s.live);
  const followId = useLive((s) => s.followId);
  const rivalId = useLive((s) => s.rivalId);
  const pool = lp.pool;
  const subject = pool.subject.driver_a;
  const raw = useMapCars(live, followId, rivalId, lp.focus);
  const cars: MapCar[] = useMemo(() => {
    const me = subject ? live?.cars.find((c) => c.id === subject) : undefined;
    if (!me) return raw;
    const gap = me.position === 1 ? '' : ` ${fmtGap(me.gapMs, 1)}`;
    return raw.map((c) => (c.id === subject ? { ...c, tag: `P${me.position} ${driverCode(me.id)}${gap}` } : c));
  }, [raw, subject, live]);
  const zone = layout === 'zone';
  const km = useMemo(() => sectorKm(circuit), [circuit]);
  // "S2 · 2,4 км · ×1,90": real sector length and the live pool multiplier.
  const callouts = zone ? (Object.fromEntries(([1, 2, 3] as const).map((s) => [s, `S${s} · ${t('pv2.kmShort', { km: fmtNumber(km[s - 1] ?? 0, 1) })} · ×${fmtOdds(multiplier(lp.book, `S${s}`))}`])) as Partial<Record<1 | 2 | 3, string>>) : undefined;
  const selected = zone && outcome && /^S[123]$/.test(outcome) ? (Number(outcome[1]) as 1 | 2 | 3) : pool.target.parameters.sector ?? null;
  const pad = zone ? 30 : 22;
  return (
    <div ref={ref} className="pl-hero__track">
      {w > 0 && h > 0 && (
        <>
          <TrackMap
            variant="neon"
            circuit={circuit}
            width={w}
            height={h}
            padding={pad}
            cars={cars}
            selectedSector={selected}
            sectorCallouts={callouts}
            showPit={layout === 'pit'}
            onSelectSector={zone && accept ? onPickSector : undefined}
            stale={live?.stale}
          />
          {layout === 'pit' && <PitLaneOverlay circuit={circuit} w={w} h={h} pad={pad} />}
        </>
      )}
    </div>
  );
});

/** The pit lane lit in lime over the neon map (same projection as TrackMap). */
function PitLaneOverlay({ circuit, w, h, pad }: { circuit: CircuitData; w: number; h: number; pad: number }) {
  const g = useMemo(() => {
    const { project } = makeSvgProjector(circuit.bounds, w, h, pad);
    const pts = circuit.pitLane.path;
    const mid = project(...(pts[Math.floor(pts.length / 2)] ?? [0, 0]));
    return { d: polylineToSvgPath(pts, project, false, 2), mid };
  }, [circuit, w, h, pad]);
  const label = t('pv2.pitLane');
  const lw = label.length * 6.4 + 16;
  const lx = Math.max(4, Math.min(w - lw - 4, g.mid[0] - lw / 2));
  const ly = Math.max(4, g.mid[1] - 30);
  return (
    <svg className="pl-hero__pit" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={g.d} className="pl-hero__pit-halo" />
      <path d={g.d} className="pl-hero__pit-line" />
      <line x1={g.mid[0]} y1={g.mid[1]} x2={g.mid[0]} y2={ly + 18} className="pl-hero__pit-lead" />
      <rect x={lx} y={ly} width={lw} height={18} rx={6} className="pl-hero__pit-box" />
      <text x={lx + lw / 2} y={ly + 12.5} textAnchor="middle" className="pl-hero__pit-text">
        {label}
      </text>
    </svg>
  );
}
