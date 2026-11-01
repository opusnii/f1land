import { ASSETS, FLAG_CODES, FLAG_WIDTHS, type AssetInfo, type AssetName } from './manifest';

export type { AssetName, AssetInfo };

// `./` in production (Telegram serves the app from a sub-path), `/` in dev.
const BASE = import.meta.env.BASE_URL;

export function assetInfo(name: string): AssetInfo | undefined {
  return (ASSETS as Record<string, AssetInfo>)[name];
}

export function hasAsset(name: string): name is AssetName {
  return assetInfo(name) !== undefined;
}

export function assetUrl(name: string, width: number, fmt: 'avif' | 'webp' = 'webp'): string {
  const a = assetInfo(name);
  if (!a) return '';
  const w = a.s.find((s) => s >= width) ?? a.s[a.s.length - 1]!;
  return `${BASE}assets/${a.g}/${name}-${w}.${fmt}`;
}

export function assetSrcSet(name: string, fmt: 'avif' | 'webp'): string {
  const a = assetInfo(name);
  if (!a) return '';
  return a.s.map((w) => `${BASE}assets/${a.g}/${name}-${Math.min(w, a.w)}.${fmt} ${Math.min(w, a.w)}w`).join(', ');
}

/* Asset lookups by domain id. Every lookup has a fallback so new data never renders a broken image. */

export function circuitPlate(circuitId: string | null | undefined): AssetName {
  const n = `circuit-${circuitId}`;
  return hasAsset(n) ? n : 'home-fallback';
}

export type PoolFamily = 'zone' | 'position' | 'duel' | 'pit' | 'tyre' | 'pace' | 'incident' | 'quali' | 'combo';

export function poolPlate(family: PoolFamily | string): AssetName {
  const n = `pool-${family}`;
  return hasAsset(n) ? n : 'pool-zone';
}

export function helmetAsset(teamId: string | null | undefined): AssetName {
  const n = `helmet-${teamId}`;
  return hasAsset(n) ? n : 'helmet-guest';
}

export function carAsset(teamId: string | null | undefined): AssetName | null {
  const n = `car-${teamId}`;
  return hasAsset(n) ? n : null;
}

export function flagUrl(cc: string, width: number): string | null {
  const c = cc.toLowerCase();
  if (!FLAG_CODES.has(c)) return null;
  const w = FLAG_WIDTHS.find((s) => s >= width) ?? FLAG_WIDTHS[FLAG_WIDTHS.length - 1];
  return `${BASE}assets/flags/${c}-${w}.webp`;
}

/** Tyre compound letter → object asset. */
export const TYRE_OBJ: Record<string, AssetName> = {
  S: 'tyre-soft',
  M: 'tyre-medium',
  H: 'tyre-hard',
  I: 'tyre-inter',
  W: 'tyre-wet',
};
