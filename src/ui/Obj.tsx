import type { CSSProperties } from 'react';
import { assetInfo, assetSrcSet, assetUrl, carAsset, flagUrl } from '@/assets';

interface ObjProps {
  name: string;
  /** Rendered box in CSS px (objects are square, trimmed and centred). */
  size?: number;
  /** Empty when a neighbouring label already names the object. */
  alt?: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}

/** Studio object from group E/H (tyres, flags, coins, trophies, badges…). Sizes 32/48/72/96. */
export function Obj({ name, size = 48, alt = '', className, style, priority }: ObjProps) {
  const info = assetInfo(name);
  if (!info) return null;
  const sizes = `${size}px`;
  return (
    <picture className={`obj${className ? ` ${className}` : ''}`} style={{ width: size, height: size, ...style }}>
      <source type="image/avif" srcSet={assetSrcSet(name, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={assetSrcSet(name, 'webp')} sizes={sizes} />
      <img src={assetUrl(name, size * 2)} alt={alt} width={size} height={size} loading={priority ? 'eager' : 'lazy'} decoding="async" draggable={false} aria-hidden={alt ? undefined : true} />
    </picture>
  );
}

/** Team car render (group C), rear three-quarter facing left. `mirror` faces it right (duel layouts). */
export function CarArt({ team, width = 180, mirror, className, alt = '' }: { team: string; width?: number; mirror?: boolean; className?: string; alt?: string }) {
  const name = carAsset(team);
  const info = name ? assetInfo(name) : undefined;
  if (!name || !info) return null;
  const h = Math.round((width * info.h) / info.w);
  return (
    <picture className={`car-art${mirror ? ' car-art--mirror' : ''}${className ? ` ${className}` : ''}`} style={{ width, height: h }}>
      <source type="image/avif" srcSet={assetSrcSet(name, 'avif')} sizes={`${width}px`} />
      <source type="image/webp" srcSet={assetSrcSet(name, 'webp')} sizes={`${width}px`} />
      <img src={assetUrl(name, width * 2)} alt={alt} width={width} height={h} loading="lazy" decoding="async" draggable={false} />
    </picture>
  );
}

/** Country flag (rasterised flag-icons, 4:3). Replaces emoji flags, which Windows renders as letters. */
export function Flag({ cc, size = 20, className, title }: { cc: string | null | undefined; size?: number; className?: string; title?: string }) {
  if (!cc) return null;
  const src = flagUrl(cc, size * 2);
  const h = Math.round(size * 0.75);
  if (!src) return <span className={`flag-img flag-img--none${className ? ` ${className}` : ''}`} style={{ width: size, height: h }} aria-hidden="true" />;
  return (
    <img
      className={`flag-img${className ? ` ${className}` : ''}`}
      src={src}
      width={size}
      height={h}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
