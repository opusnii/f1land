import type { CSSProperties, ReactNode } from 'react';
import { assetInfo, assetSrcSet, assetUrl } from '@/assets';

export type Scrim = 'b' | 'l' | 'r' | 'full' | 'none';

interface ArtProps {
  /** Asset id from src/assets/manifest.ts. */
  name: string;
  /** Empty for decorative art (the default). */
  alt?: string;
  /** `sizes` for the srcset; defaults to the full column width of a phone. */
  sizes?: string;
  /** Above-the-fold hero: eager + high fetch priority. */
  priority?: boolean;
  scrim?: Scrim;
  /** object-position, e.g. '70% 50%' to keep the subject of a wide plate in frame. */
  focal?: string;
  /** Fixed aspect ratio (e.g. '16 / 10'); omit when the parent sizes the art. */
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function markLoaded(el: HTMLImageElement | null) {
  if (el?.complete && el.naturalWidth > 0) el.dataset.loaded = '1';
}

/**
 * Raster art (S3 surface). Renders AVIF/WebP `<picture>` over a placeholder in the asset's mean colour,
 * fades in once decoded. Text never lives in the image; overlay it as children.
 */
export function Art({ name, alt = '', sizes = 'min(100vw, 480px)', priority, scrim = 'none', focal, ratio, className, style, children }: ArtProps) {
  const info = assetInfo(name);
  const css = { '--art-c': info?.c ?? '#10161a', aspectRatio: ratio, ...style } as CSSProperties;
  return (
    <div className={`art${scrim !== 'none' ? ` art--scrim-${scrim}` : ''}${className ? ` ${className}` : ''}`} style={css}>
      {info && (
        <picture>
          {info.f !== 'webp' && <source type="image/avif" srcSet={assetSrcSet(name, 'avif')} sizes={sizes} />}
          <source type="image/webp" srcSet={assetSrcSet(name, 'webp')} sizes={sizes} />
          <img
            className="art__img"
            src={assetUrl(name, 780)}
            alt={alt}
            width={info.w}
            height={info.h}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            draggable={false}
            ref={markLoaded}
            onLoad={(e) => (e.currentTarget.dataset.loaded = '1')}
            style={focal ? { objectPosition: focal } : undefined}
          />
        </picture>
      )}
      {children}
    </div>
  );
}
