/* Design-system primitives (docs/design/02-spec-and-plan.md §8): hero plate, display type, tagline, status, empty state. */
import type { ReactNode } from 'react';
import type { PoolStatus } from '@/domain/types';
import { t } from '@/i18n/core';
import { Art, type Scrim } from './Art';
import { Obj } from './Obj';

/* ------------------------------------------------------------------ */
/* Hero plate (S3)                                                     */
/* ------------------------------------------------------------------ */

interface HeroPlateProps {
  art: string;
  height?: number;
  scrim?: Scrim;
  focal?: string;
  priority?: boolean;
  className?: string;
  children?: ReactNode;
  /** Optional slot rendered above the scrim but below children (e.g. neon track SVG). */
  layer?: ReactNode;
}

export function HeroPlate({ art, height = 220, scrim = 'b', focal, priority, className, children, layer }: HeroPlateProps) {
  return (
    <section className={`hero-plate${className ? ` ${className}` : ''}`} style={{ height }}>
      <Art name={art} scrim={scrim} focal={focal} priority={priority} className="hero-plate__art" />
      {layer && <div className="hero-plate__layer">{layer}</div>}
      <div className="hero-plate__body">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Display title: Exo 2 Italic 900 caps (has Cyrillic)                 */
/* ------------------------------------------------------------------ */

export function DisplayTitle({ children, icon, as: Tag = 'h2', size = 'md', className }: { children: ReactNode; icon?: ReactNode; as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <Tag className={`display-title display-title--${size}${className ? ` ${className}` : ''}`}>
      {icon && (
        <span className="display-title__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="display-title__text">{children}</span>
    </Tag>
  );
}

/** Hand-written slogan (Caveat). Decorative: at most one per hero screen. */
export function Tagline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`tagline${className ? ` ${className}` : ''}`} aria-hidden="true">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Pool status — the single source of truth for status copy and tone   */
/* ------------------------------------------------------------------ */

export type StatusTone = 'live' | 'open' | 'warn' | 'locked' | 'resolving' | 'settled' | 'void' | 'muted';

export interface PoolStatusView {
  tone: StatusTone;
  label: string;
}

/**
 * `accept` = the pool is taking entries right now. "Live pool" is only ever shown when it is true,
 * so a resolving pool can no longer read as both "Resolving" and "Live pool".
 */
export function poolStatusView(status: PoolStatus, accept: boolean, suspended = false): PoolStatusView {
  if (status === 'OPEN' && suspended) return { tone: 'warn', label: t('pool.suspended') };
  if (status === 'OPEN' && accept) return { tone: 'live', label: t('sys.status.live') };
  if (status === 'OPEN') return { tone: 'locked', label: t('pool2.headerLocked') };
  if (status === 'LOCKED') return { tone: 'locked', label: t('pool.status.LOCKED') };
  if (status === 'RESOLVING') return { tone: 'resolving', label: t('pool.status.RESOLVING') };
  if (status === 'SETTLED') return { tone: 'settled', label: t('pool.status.SETTLED') };
  if (status === 'VOID') return { tone: 'void', label: t('pool.status.VOID') };
  return { tone: 'muted', label: t(`pool.status.${status}`) };
}

export function StatusChip({ status, accept, suspended, className }: { status: PoolStatus; accept: boolean; suspended?: boolean; className?: string }) {
  const v = poolStatusView(status, accept, suspended);
  return (
    <span className={`status-chip status-chip--${v.tone}${className ? ` ${className}` : ''}`} role="status">
      <span className="status-chip__dot" aria-hidden="true" />
      {v.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({ art, title, body, action, tagline, compact }: { art?: string; title: ReactNode; body?: ReactNode; action?: ReactNode; tagline?: ReactNode; compact?: boolean }) {
  return (
    <div className={`empty-state${compact ? ' empty-state--compact' : ''}`}>
      {art && <Obj name={art} size={compact ? 96 : 132} className="empty-state__art" />}
      <p className="empty-state__title">{title}</p>
      {body && <p className="empty-state__body">{body}</p>}
      {action && <div className="empty-state__action">{action}</div>}
      {tagline && <Tagline className="empty-state__tagline">{tagline}</Tagline>}
    </div>
  );
}
