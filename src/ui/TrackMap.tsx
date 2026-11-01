import { memo, useId, useMemo } from 'react';
import type { CircuitData, Vec2 } from '@/data/circuits/types';
import { makeSvgProjector, polylineToSvgPath, TrackGeometry } from '@/data/circuits/geometry';
import { DRIVER_BY_ID, TEAM_BY_ID } from '@/data/teams';
import { t } from '@/i18n/core';

export const SECTOR_COLORS = ['#c6ff3d', '#2fe6ff', '#b26bff'];

export interface MapCar {
  id: string;
  x: number;
  y: number;
  inPit?: boolean;
  kind?: 'follow' | 'rival' | 'near' | 'other';
  position?: number;
  /** Neon variant: glass tag text for the followed / rival car, e.g. "P6 LEC +4.2s". */
  tag?: string;
}

interface Props {
  circuit: CircuitData;
  cars?: MapCar[];
  selectedSector?: 1 | 2 | 3 | null;
  onSelectSector?: (s: 1 | 2 | 3) => void;
  showPit?: boolean;
  showZones?: boolean;
  showCorners?: boolean;
  glow?: boolean;
  width?: number;
  height?: number;
  padding?: number;
  /** Highlight a sector with its multiplier label (position pool). */
  sectorLabels?: Partial<Record<1 | 2 | 3, string>>;
  className?: string;
  stale?: boolean;
  /** 'neon' = night-race layers for art plates and heroes (spec §7.1); 'plain' = flat data map. */
  variant?: 'plain' | 'neon';
  /** Neon variant: glass callouts with a leader line from each sector's midpoint, e.g. "S2 · 2.4 km · ×1.9". */
  sectorCallouts?: Partial<Record<1 | 2 | 3, string>>;
}

interface Prepared {
  project: (x: number, y: number) => Vec2;
  scale: number;
  sectors: string[];
  pit: string;
  full: string;
  startLine: { x1: number; y1: number; x2: number; y2: number };
  arrows: Array<{ x: number; y: number; a: number }>;
  zones: string[];
  corners: Array<{ n: number; x: number; y: number }>;
  sectorMid: Vec2[];
}

const cache = new WeakMap<CircuitData, Map<string, Prepared>>();

function prepare(c: CircuitData, w: number, h: number, pad: number): Prepared {
  const key = `${w}x${h}:${pad}`;
  let m = cache.get(c);
  if (!m) {
    m = new Map();
    cache.set(c, m);
  }
  const hit = m.get(key);
  if (hit) return hit;
  const geom = new TrackGeometry(c.centerline, true);
  const { project, scale } = makeSvgProjector(c.bounds, w, h, pad);
  const L = geom.length;
  const segPath = (s0: number, s1: number) => {
    let len = s1 - s0;
    if (len <= 0) len += L;
    const n = Math.max(2, Math.round(len / 12));
    const pts: Vec2[] = [];
    for (let i = 0; i <= n; i++) pts.push(geom.pointAt(s0 + (len * i) / n));
    return polylineToSvgPath(pts, project, false);
  };
  const sectors = c.sectors.map((s) => segPath(s.startS, s.endS));
  const full = polylineToSvgPath(c.centerline, project, true, 3);
  const pit = polylineToSvgPath(c.pitLane.path, project, false, 2);
  const hw = c.widthM / 2 + 6 / Math.max(0.05, scale);
  const a = geom.pointAt(0, hw);
  const b = geom.pointAt(0, -hw);
  const pa = project(a[0], a[1]);
  const pb = project(b[0], b[1]);
  const arrows: Prepared['arrows'] = [];
  for (const f of [0.12, 0.45, 0.78]) {
    const s = L * f;
    const p = geom.pointAt(s);
    const q = geom.pointAt(s + 10);
    const pp = project(p[0], p[1]);
    const qq = project(q[0], q[1]);
    arrows.push({ x: pp[0], y: pp[1], a: (Math.atan2(qq[1] - pp[1], qq[0] - pp[0]) * 180) / Math.PI });
  }
  const zones = c.straightZones.map((z) => segPath(z.startS, z.endS));
  const corners = c.corners.map((cn) => {
    const side = cn.direction === 'L' ? -1 : 1;
    const p = geom.pointAt(cn.s, side * (c.widthM / 2 + 14 / Math.max(0.05, scale)));
    const pp = project(p[0], p[1]);
    return { n: cn.number, x: pp[0], y: pp[1] };
  });
  const sectorMid = c.sectors.map((s) => {
    let len = s.endS - s.startS;
    if (len <= 0) len += L;
    const p = geom.pointAt(s.startS + len / 2);
    return project(p[0], p[1]);
  });
  const prep: Prepared = { project, scale, sectors, pit, full, startLine: { x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1] }, arrows, zones, corners, sectorMid };
  m.set(key, prep);
  return prep;
}

/**
 * Base interactive layer (F1-045): SVG circuit with sectors, pit path,
 * control line and approximate car dots. Works without WebGL.
 */
export const TrackMap = memo(function TrackMap(props: Props) {
  return props.variant === 'neon' ? <NeonTrack {...props} /> : <PlainTrack {...props} />;
});

const PlainTrack = function PlainTrack({
  circuit,
  cars = [],
  selectedSector = null,
  onSelectSector,
  showPit = true,
  showZones = true,
  showCorners = false,
  glow = false,
  width = 300,
  height = 220,
  padding = 14,
  sectorLabels,
  className,
  stale,
}: Props) {
  const p = useMemo(() => prepare(circuit, width, height, padding), [circuit, width, height, padding]);
  const sw = Math.max(3, Math.min(7, width / 60));
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className={`trackmap ${className ?? ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${circuit.name}. ${t('f1.data.approximate')}`}>
      <defs>
        <filter id={`tm-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={p.full} className="trackmap__base" strokeWidth={sw + 5} />
      <path d={p.full} className="trackmap__edge" strokeWidth={sw + 1.6} />
      {showPit && <path d={p.pit} className="trackmap__pit" strokeWidth={1.6} />}
      {p.sectors.map((d, i) => {
        const sel = selectedSector === i + 1;
        const dim = selectedSector !== null && !sel;
        return (
          <path
            key={i}
            d={d}
            className="trackmap__sector"
            stroke={SECTOR_COLORS[i]}
            strokeWidth={sel ? sw + 1.5 : sw - 0.6}
            opacity={dim ? 0.28 : 1}
            filter={glow ? `url(#tm-glow-${uid})` : undefined}
            style={{ cursor: onSelectSector ? 'pointer' : undefined }}
            onClick={onSelectSector ? () => onSelectSector((i + 1) as 1 | 2 | 3) : undefined}
          />
        );
      })}
      {showZones &&
        p.zones.map((d, i) => <path key={`z${i}`} d={d} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="2 3" />)}
      <line {...p.startLine} stroke="#fff" strokeWidth={2.2} />
      {p.arrows.map((a, i) => (
        <path key={i} d="M-3,-2.6 L2.5,0 L-3,2.6" transform={`translate(${a.x},${a.y}) rotate(${a.a})`} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.3} />
      ))}
      {showCorners &&
        p.corners.map((c) => (
          <text key={c.n} x={c.x} y={c.y + 2.5} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.55)" fontFamily="Chakra Petch">
            {c.n}
          </text>
        ))}
      {sectorLabels &&
        ([1, 2, 3] as const).map((s) =>
          sectorLabels[s] ? (
            <g key={`sl${s}`} transform={`translate(${p.sectorMid[s - 1]![0]},${p.sectorMid[s - 1]![1]})`} opacity={selectedSector && selectedSector !== s ? 0.6 : 1}>
              <rect x={-20} y={-21} width={40} height={16} rx={5} fill="rgba(5,8,10,0.85)" stroke={SECTOR_COLORS[s - 1]} strokeWidth={selectedSector === s ? 1.6 : 0.8} />
              <text y={-10} textAnchor="middle" fontSize="9" fontWeight="700" fill={SECTOR_COLORS[s - 1]} fontFamily="Chakra Petch">
                {sectorLabels[s]}
              </text>
            </g>
          ) : null,
        )}
      {cars.map((c) => {
        const [x, y] = p.project(c.x, c.y);
        const d = DRIVER_BY_ID[c.id];
        const color = d ? TEAM_BY_ID[d.teamId]!.color : '#fff';
        const big = c.kind === 'follow' || c.kind === 'rival';
        // Keep driver tags inside the viewBox: flip left / below near the right / top edges.
        const lw = c.position ? 30 : 22;
        const lx = x + 6 + lw > width - 1 ? -6 - lw : 6;
        const ly = y < 14 ? 9 : -7;
        return (
          <g key={c.id} className="trackmap__dot" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} opacity={stale ? 0.5 : 1}>
            {c.kind === 'follow' && <circle r={9} fill="none" stroke="var(--lime)" strokeWidth={1.4} opacity={0.8} />}
            {c.kind === 'rival' && <circle r={8} fill="none" stroke="var(--cyan)" strokeWidth={1.2} opacity={0.8} />}
            <circle r={big ? 4.6 : 3.3} fill={color} stroke="#05080a" strokeWidth={1.2} />
            {(c.kind === 'follow' || c.kind === 'rival' || c.kind === 'near') && d && (
              <g transform={`translate(${lx},${ly})`}>
                <rect x={0} y={-6} width={lw} height={11} rx={3} fill="rgba(5,8,10,0.9)" stroke={c.kind === 'follow' ? 'var(--lime)' : c.kind === 'rival' ? 'var(--cyan)' : 'rgba(255,255,255,.25)'} strokeWidth={0.8} />
                <text x={3} y={2} className="trackmap__label">
                  {c.position ? `${c.position} ` : ''}
                  {d.code}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

function teamColor(id: string): string {
  const d = DRIVER_BY_ID[id];
  return d ? TEAM_BY_ID[d.teamId]!.color : '#fff';
}

interface PlacedCar {
  c: MapCar;
  x: number;
  y: number;
  tag: string;
  tw: number;
  /** Tag offset relative to the car. */
  tx: number;
  ty: number;
}

/**
 * Tag placement without overlaps: followed car first, then rival, then the rest; each tag tries
 * above-right, above-left, below-right, below-left and keeps the first free slot inside the viewBox.
 */
function placeTags(cars: MapCar[], project: (x: number, y: number) => Vec2, width: number, height: number): PlacedCar[] {
  const rank = (c: MapCar) => (c.kind === 'follow' ? 0 : c.kind === 'rival' ? 1 : c.kind === 'near' ? 2 : 3);
  const order = [...cars].sort((a, b) => rank(a) - rank(b));
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  const out: PlacedCar[] = [];
  for (const c of order) {
    const [x, y] = project(c.x, c.y);
    const d = DRIVER_BY_ID[c.id];
    const tag = c.tag ?? (c.kind === 'follow' || c.kind === 'rival' || c.kind === 'near' ? `${c.position ? `P${c.position} ` : ''}${d?.code ?? ''}` : '');
    const tw = tag ? textW(tag, 8.5) : 0;
    let tx = 10;
    let ty = -16;
    if (tag) {
      const slots: Array<[number, number]> = [
        [10, -16],
        [-10 - tw, -16],
        [10, 4],
        [-10 - tw, 4],
      ];
      const fits = ([ox, oy]: [number, number]) => x + ox >= 1 && x + ox + tw <= width - 1 && y + oy >= 1 && y + oy + 14 <= height - 1;
      const free = ([ox, oy]: [number, number]) => !boxes.some((b) => x + ox < b.x + b.w && b.x < x + ox + tw && y + oy < b.y + b.h && b.y < y + oy + 14);
      const pick = slots.find((s) => fits(s) && free(s)) ?? slots.find(fits) ?? slots[0]!;
      [tx, ty] = pick;
      boxes.push({ x: x + tx - 2, y: y + ty - 2, w: tw + 4, h: 18 });
    }
    out.push({ c, x, y, tag, tw, tx, ty });
  }
  // Draw lower-priority cars first so the followed car and its tag sit on top.
  return out.reverse();
}

/** Approximate glyph width for 9 px Onest/Chakra labels inside the viewBox. */
const textW = (s: string, fs: number) => s.length * fs * 0.62 + 12;

/**
 * Night-race map (spec §7.1): shadow → kerb edge → asphalt → glowing sectors → selected-sector band →
 * start/finish chequer and dashed pit lane → team-colour cars with glass tags → sector callouts.
 * Positions stay approximate (SRS); the aria-label says so.
 */
function NeonTrack({
  circuit,
  cars = [],
  selectedSector = null,
  onSelectSector,
  showPit = true,
  showCorners = false,
  width = 300,
  height = 220,
  padding = 14,
  sectorCallouts,
  className,
  stale,
}: Props) {
  const p = useMemo(() => prepare(circuit, width, height, padding), [circuit, width, height, padding]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sw = Math.max(3, Math.min(6, width / 70));
  const { x1, y1, x2, y2 } = p.startLine;
  const startLen = Math.hypot(x2 - x1, y2 - y1);
  const startAng = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  // Car tag boxes (absolute coords) so sector callouts can step out of their way.
  const placed = placeTags(cars, p.project, width, height);
  const tagBoxes = placed.filter((pc) => pc.tag).map((pc) => ({ x: pc.x + pc.tx - 12, y: pc.y + pc.ty - 4, w: pc.tw + 24, h: 22 }));
  const tagKey = tagBoxes.map((b) => `${b.x | 0},${b.y | 0}`).join(';');

  const callouts = useMemo(() => {
    if (!sectorCallouts) return [];
    const cx = width / 2;
    const cy = height / 2;
    const out = ([1, 2, 3] as const)
      .filter((s) => sectorCallouts[s])
      .map((s) => {
        const [ax, ay] = p.sectorMid[s - 1]!;
        const text = sectorCallouts[s]!;
        const fs = 9;
        const w = textW(text, fs);
        const h = 17;
        const dx = ax - cx;
        const dy = ay - cy;
        const len = Math.hypot(dx, dy) || 1;
        let lx = ax + (dx / len) * 26 - w / 2;
        let ly = ay + (dy / len) * 22 - h / 2;
        lx = Math.max(2, Math.min(width - w - 2, lx));
        ly = Math.max(2, Math.min(height - h - 2, ly));
        return { s, ax, ay, lx, ly, w, h, text, fs };
      })
      .sort((a, b) => a.ly - b.ly);
    const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    // Stack overlapping plates vertically (same approach as the 3D label layer), then step clear of car tags.
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [...tagBoxes];
    for (const c of out) {
      for (let tries = 0; tries < 8; tries++) {
        const box = { x: c.lx, y: c.ly, w: c.w, h: c.h + 3 };
        const other = placed.find((b) => hit(box, b));
        if (!other) break;
        const down = other.y + other.h + 2;
        const up = other.y - c.h - 3;
        c.ly = down + c.h <= height - 2 ? down : Math.max(2, up);
      }
      placed.push({ x: c.lx, y: c.ly, w: c.w, h: c.h });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorCallouts, p, width, height, tagKey]);

  return (
    <svg className={`trackmap trackmap--neon ${className ?? ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${circuit.name}. ${t('f1.data.approximate')}`}>
      <defs>
        <filter id={`sh-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`gl-${uid}`} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="near" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="4.2" result="far" />
          <feComponentTransfer in="far" result="farDim">
            <feFuncA type="linear" slope="0.45" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="farDim" />
            <feMergeNode in="near" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={`ck-${uid}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="#0a0d10" />
          <rect width="1.5" height="1.5" fill="#fff" />
          <rect x="1.5" y="1.5" width="1.5" height="1.5" fill="#fff" />
        </pattern>
      </defs>
      <path d={p.full} fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={sw + 10} filter={`url(#sh-${uid})`} strokeLinejoin="round" />
      <path d={p.full} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={sw + 5.5} strokeLinejoin="round" />
      <path d={p.full} fill="none" stroke="#151b20" strokeWidth={sw + 4} strokeLinejoin="round" />
      {showPit && <path d={p.pit} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.3} strokeDasharray="3 3" />}
      {selectedSector && <path d={p.sectors[selectedSector - 1]} fill="none" stroke={SECTOR_COLORS[selectedSector - 1]} strokeOpacity={0.14} strokeWidth={18} strokeLinecap="round" />}
      <g filter={`url(#gl-${uid})`}>
        {p.sectors.map((d, i) => {
          const sel = selectedSector === i + 1;
          const dim = selectedSector !== null && !sel;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={SECTOR_COLORS[i]}
              strokeWidth={sel ? 4 : 2.6}
              strokeLinecap="round"
              opacity={dim ? 0.38 : 1}
              style={{ cursor: onSelectSector ? 'pointer' : undefined }}
              onClick={onSelectSector ? () => onSelectSector((i + 1) as 1 | 2 | 3) : undefined}
            />
          );
        })}
      </g>
      <rect x={x1} y={y1 - 2} width={startLen} height={4} fill={`url(#ck-${uid})`} transform={`rotate(${startAng} ${x1} ${y1})`} />
      {showCorners &&
        p.corners.map((c) => (
          <text key={c.n} x={c.x} y={c.y + 2.5} textAnchor="middle" className="trackmap__corner">
            {c.n}
          </text>
        ))}
      {callouts.map((c) => {
        const color = SECTOR_COLORS[c.s - 1]!;
        const tx = c.lx + c.w / 2;
        const ty = c.ly + c.h / 2;
        const dim = selectedSector !== null && selectedSector !== c.s;
        return (
          <g key={`co${c.s}`} opacity={dim ? 0.55 : 1}>
            <line x1={c.ax} y1={c.ay} x2={tx} y2={ty} stroke={color} strokeOpacity={0.6} strokeWidth={0.8} />
            <circle cx={c.ax} cy={c.ay} r={2} fill={color} />
            <rect x={c.lx} y={c.ly} width={c.w} height={c.h} rx={6} className="trackmap__glass" stroke={color} strokeOpacity={selectedSector === c.s ? 0.9 : 0.45} />
            <text x={tx} y={ty + 3.2} textAnchor="middle" className="trackmap__callout" fontSize={c.fs}>
              {c.text}
            </text>
          </g>
        );
      })}
      {placed.map(({ c, x, y, tag, tw, tx, ty }) => {
        const color = teamColor(c.id);
        const big = c.kind === 'follow' || c.kind === 'rival';
        const ring = c.kind === 'follow' ? 'var(--lime)' : c.kind === 'rival' ? 'var(--cyan)' : null;
        return (
          <g key={c.id} className="trackmap__dot" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} opacity={stale ? 0.5 : 1}>
            {ring && <circle r={10} fill="none" stroke={ring} strokeWidth={1.5} />}
            {ring && <circle r={10} fill={ring} opacity={0.12} />}
            <circle r={big ? 4.2 : 3} fill={color} stroke="#05080a" strokeWidth={1.5} />
            {tag && (
              <g transform={`translate(${tx},${ty})`}>
                <rect width={tw} height={14} rx={5} className="trackmap__glass" stroke={ring ?? 'rgba(255,255,255,.25)'} strokeOpacity={ring ? 0.85 : 1} />
                <text x={tw / 2} y={10} textAnchor="middle" className="trackmap__tag">
                  {tag}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
