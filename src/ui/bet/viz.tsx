/* Reusable pool infographics (spec §8): gap meter, stint bar, event timeline, sector glyph. Data in, no invented values. */
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { TYRE_OBJ } from '@/assets';
import type { CircuitData, Vec2 } from '@/data/circuits/types';
import { makeSvgProjector, polylineToSvgPath, TrackGeometry } from '@/data/circuits/geometry';
import { DRIVER_BY_ID, TEAM_BY_ID } from '@/data/teams';
import { fmtSec, t } from '@/i18n/core';
import { Obj } from '@/ui/Obj';
import { SECTOR_COLORS } from '@/ui/TrackMap';
import '@/styles/pool/viz.css';

export const teamColorOf = (driverId?: string | null): string => (driverId ? (TEAM_BY_ID[DRIVER_BY_ID[driverId]?.teamId ?? '']?.color ?? '#7d8a93') : '#7d8a93');
export const COMPOUND_COLOR: Record<string, string> = { SOFT: 'var(--soft)', MEDIUM: 'var(--medium)', HARD: 'var(--hard)', INTERMEDIATE: 'var(--inter)', WET: 'var(--wet)' };
export const tyreObj = (compound: string | null | undefined) => (compound ? TYRE_OBJ[compound[0]!] : undefined);

/** Size of an element, kept in sync with its box (for SVG that must render 1:1, not scaled). */
export function useBoxSize<T extends HTMLElement>(fw: number, fh: number): [RefObject<T | null>, number, number] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<[number, number]>([fw, fh]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e!.contentRect.width);
      const h = Math.round(e!.contentRect.height);
      if (w > 0 && h > 0) setSize((s) => (s[0] === w && s[1] === h ? s : [w, h]));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size[0], size[1]];
}

/* ------------------------------------------------------------------ */
/* GapMeter                                                            */
/* ------------------------------------------------------------------ */

export type GapTrend = 'closing' | 'growing' | 'steady' | null;

/** Track the direction of a live gap between renders (real values only). */
export function useGapTrend(gapMs: number | null): GapTrend {
  const prev = useRef<number | null>(null);
  const [trend, setTrend] = useState<GapTrend>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = gapMs;
    if (before === null || gapMs === null) return;
    const d = Math.abs(gapMs) - Math.abs(before);
    if (Math.abs(d) < 40) return;
    setTrend(d < 0 ? 'closing' : 'growing');
  }, [gapMs]);
  return gapMs === null ? null : trend;
}

/** Bar between two drivers: team-coloured ends, the gap in the middle, trend underneath. */
export function GapMeter({ a, b, gapMs, trend, label }: { a: string; b: string; gapMs: number | null; trend?: GapTrend; label?: string }) {
  const style = { '--ga': teamColorOf(a), '--gb': teamColorOf(b) } as CSSProperties;
  const v = gapMs === null ? '—' : fmtSec(Math.abs(gapMs), 3);
  return (
    <div className="gapm" style={style} role="img" aria-label={gapMs === null ? (label ?? t('live.gap')) : `${label ?? t('live.gap')}: ${t('pv2.gapAria', { gap: v })}${trend ? `. ${t(`pv2.trend.${trend}`)}` : ''}`}>
      <span className="gapm__bar" aria-hidden="true">
        <i className="gapm__end gapm__end--a" />
        <i className="gapm__end gapm__end--b" />
      </span>
      <span className="gapm__val" aria-hidden="true">
        {label && <small className="techlabel">{label}</small>}
        <b className="num">{v}</b>
      </span>
      {trend && (
        <span className={`gapm__trend gapm__trend--${trend}`} aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d={trend === 'growing' ? 'M2 3.5 5 6.5 8 3.5' : trend === 'closing' ? 'M2 6.5 5 3.5 8 6.5' : 'M2 5h6'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t(`pv2.trend.${trend}`)}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StintBar                                                            */
/* ------------------------------------------------------------------ */

export interface Stint {
  compound: string;
  fromLap: number;
  toLap: number | null;
}

/** Tyre strategy: compound-coloured stints, tyre objects at the joins, chequered flag at the finish. */
export function StintBar({ stints, total, now }: { stints: Stint[]; total: number; now?: number }) {
  const T = Math.max(1, total);
  const pct = (lap: number) => `${Math.max(0, Math.min(100, (lap / T) * 100))}%`;
  return (
    <div className="stintbar">
      <div className="stintbar__track">
        {stints.map((s, i) => {
          const from = Math.max(0, s.fromLap - 1);
          const to = s.toLap ?? now ?? from + 1;
          return (
            <span
              key={i}
              className={`stintbar__seg ${s.toLap === null ? 'stintbar__seg--now' : ''}`}
              style={{ left: pct(from), width: `${(Math.max(0.6, to - from) / T) * 100}%`, ['--c' as string]: COMPOUND_COLOR[s.compound] ?? 'var(--muted)' }}
            />
          );
        })}
        {stints.map((s, i) => {
          const o = tyreObj(s.compound);
          return (
            <span key={`o${i}`} className="stintbar__tyre" style={{ left: pct(Math.max(0, s.fromLap - 1)) }}>
              {o && <Obj name={o} size={26} alt={t(`tyre.${s.compound.toLowerCase()}`)} />}
            </span>
          );
        })}
        {now !== undefined && <span className="stintbar__now" style={{ left: pct(now) }} aria-hidden="true" />}
        <span className="stintbar__flag" aria-hidden="true">
          <Obj name="flag-chequered" size={26} />
        </span>
      </div>
      <div className="stintbar__axis num" aria-hidden="true">
        {stints.map((s, i) => (
          <span key={i} style={{ left: pct(Math.max(0, s.fromLap - 1)) }}>
            {Math.max(0, s.fromLap - 1)}
          </span>
        ))}
        <span className="stintbar__axis-end">{T}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EventTimeline                                                       */
/* ------------------------------------------------------------------ */

export interface TimelineItem {
  id: string;
  lap: number | null;
  badge: ReactNode;
  text: string;
  /** Accent for the node ring (semantic: yellow SC/VSC, red RED, green GREEN). */
  tone?: string;
}

/** Vertical race-control log: lap · badge node · message. Newest first. */
export function EventTimeline({ items, empty }: { items: TimelineItem[]; empty: string }) {
  if (!items.length) return <p className="evtl__empty">{empty}</p>;
  return (
    <ol className="evtl">
      {items.map((it) => (
        <li key={it.id} className="evtl__row" style={it.tone ? ({ ['--tone' as string]: it.tone } as CSSProperties) : undefined}>
          <span className="evtl__lap num">{it.lap && it.lap > 0 ? t('pv2.lapN', { n: it.lap }) : '—'}</span>
          <span className="evtl__node" aria-hidden="true">
            {it.badge}
          </span>
          <span className="evtl__text">{it.text}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Sector glyph: whole circuit faint, one sector lit in its colour      */
/* ------------------------------------------------------------------ */

const glyphCache = new WeakMap<CircuitData, Map<string, { full: string; sectors: string[] }>>();

function glyphPaths(c: CircuitData, w: number, h: number) {
  let m = glyphCache.get(c);
  if (!m) {
    m = new Map();
    glyphCache.set(c, m);
  }
  const key = `${w}x${h}`;
  const hit = m.get(key);
  if (hit) return hit;
  const geom = new TrackGeometry(c.centerline, true);
  const { project } = makeSvgProjector(c.bounds, w, h, 3);
  const L = geom.length;
  const sectors = c.sectors.map((s) => {
    let len = s.endS - s.startS;
    if (len <= 0) len += L;
    const n = Math.max(2, Math.round(len / 40));
    const pts: Vec2[] = [];
    for (let i = 0; i <= n; i++) pts.push(geom.pointAt(s.startS + (len * i) / n));
    return polylineToSvgPath(pts, project, false);
  });
  const out = { full: polylineToSvgPath(c.centerline, project, true, 6), sectors };
  m.set(key, out);
  return out;
}

export const SectorGlyph = memo(function SectorGlyph({ circuit, sector, width = 64, height = 40 }: { circuit: CircuitData; sector: 1 | 2 | 3; width?: number; height?: number }) {
  const p = useMemo(() => glyphPaths(circuit, width, height), [circuit, width, height]);
  const color = SECTOR_COLORS[sector - 1]!;
  return (
    <svg className="secglyph" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={p.full} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2" strokeLinejoin="round" />
      <path d={p.sectors[sector - 1]} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

/** Sector lengths in km from the circuit's own sector boundaries. */
export function sectorKm(c: CircuitData | null | undefined): number[] {
  if (!c) return [];
  const L = c.centerlineLengthM;
  const scale = c.lengthM / L;
  return c.sectors.map((s) => ((((s.endS - s.startS + L) % L) || L) * scale) / 1000);
}
