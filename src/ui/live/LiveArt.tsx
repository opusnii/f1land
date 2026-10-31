import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLive } from '@/store/live';
import { DRIVER_BY_ID } from '@/data/teams';
import { circuitPlate } from '@/assets';
import { fmtGap, t } from '@/i18n/core';
import { useMapCars } from '@/app/hooks';
import { Art } from '@/ui/Art';
import { TrackMap, type MapCar } from '@/ui/TrackMap';

/**
 * Live "2D art" view (spec §9.2): the circuit plate under the neon SVG track with moving cars.
 * Cheap enough to be the default on low-tier devices; positions stay approximate (labelled).
 */
export function LiveArt({ labels }: { labels: string[] }) {
  const runner = useLive((s) => s.runner);
  const live = useLive((s) => s.live);
  const followId = useLive((s) => s.followId);
  const rivalId = useLive((s) => s.rivalId);
  const leaderId = live?.cars[0]?.id ?? null;
  const extra = useMemo(() => (leaderId ? [...labels, leaderId] : labels), [labels, leaderId]);
  const raw = useMapCars(live, followId, rivalId, extra);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 360 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const apply = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 40 && h > 40) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Followed / rival tags carry the interval, as in the reference's car call-outs.
  const cars = useMemo(() => {
    const byId = new Map(live?.cars.map((c) => [c.id, c]) ?? []);
    return raw.map((c): MapCar => {
      if (c.kind !== 'follow' && c.kind !== 'rival') return c;
      const lc = byId.get(c.id);
      const gap = lc && lc.position > 1 && lc.intervalMs !== null ? ` ${fmtGap(lc.intervalMs, 1)}` : '';
      return { ...c, tag: `P${c.position ?? ''} ${DRIVER_BY_ID[c.id]?.code ?? ''}${gap}` };
    });
  }, [raw, live]);

  if (!runner) return null;
  return (
    <div className="scene-2d scene-art">
      <Art name={circuitPlate(runner.channel.circuitId)} priority sizes="100vw" className="scene-art__plate" />
      <div className="scene-art__map" ref={box}>
        <TrackMap variant="neon" circuit={runner.circuit} cars={cars} width={size.w} height={size.h} padding={Math.round(Math.min(size.w, size.h) * 0.08)} showPit stale={live?.stale} />
      </div>
      <span className="scene-art__approx">{t('sys.approx')}</span>
    </div>
  );
}
