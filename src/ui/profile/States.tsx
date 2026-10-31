/* Shared screen states (spec §9.7): skeletons in one shape language and the paused-feed state. */
import { useLive } from '@/store/live';
import { t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { Art } from '@/ui/Art';
import { IconPlay } from '@/ui/icons';

/** A row skeleton shaped like the list rows it stands in for: tile, two lines, value. */
export function SkelRow() {
  return (
    <div className="pv-skrow" aria-hidden="true">
      <span className="skel pv-skrow__tile" />
      <span className="pv-skrow__lines">
        <span className="skel pv-skrow__l1" />
        <span className="skel pv-skrow__l2" />
      </span>
      <span className="skel pv-skrow__v" />
    </div>
  );
}

/** Loading placeholder for a list or card body. Announced once as "Loading…". */
export function SkelList({ rows = 3, card = true }: { rows?: number; card?: boolean }) {
  return (
    <div className={`pv-sklist${card ? ' card' : ''}`} role="status" aria-label={t('ui.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <SkelRow key={i} />
      ))}
    </div>
  );
}

/** Whole-screen placeholder: title, hero block and a list (Suspense fallback shape). */
export function ScreenSkeleton() {
  return (
    <div className="pv-skscreen" role="status" aria-label={t('ui.loading')}>
      <span className="skel pv-skscreen__title" />
      <span className="skel pv-skscreen__sub" />
      <span className="skel pv-skscreen__hero" />
      <SkelList rows={3} />
    </div>
  );
}

/** True while the live feed is stale (the runner's existing feed-gap signal). */
export function useFeedPaused(): boolean {
  return useLive((s) => !!s.live?.stale);
}

function retryFeed() {
  haptic.tap();
  useLive.getState().runner?.setStale(false);
}

/** "Live data is paused" with the empty pit-wall plate and a retry button. */
export function OfflineState({ compact, onRetry = retryFeed }: { compact?: boolean; onRetry?: () => void }) {
  return (
    <section className={`card pv-offline${compact ? ' pv-offline--compact' : ''}`} role="status" aria-live="polite">
      <Art name="offline" scrim="b" ratio={compact ? '21 / 8' : '3 / 2'} focal="40% 50%" className="pv-offline__art" />
      <div className="pv-offline__body">
        <h2 className="pv-offline__title">{t('sys.offline.title')}</h2>
        {!compact && <p className="pv-offline__text">{t('sys.offline.body')}</p>}
        <button type="button" className="btn btn--ghost btn--sm pv-offline__retry" onClick={onRetry}>
          <IconPlay size={14} />
          {t('sys.retry')}
        </button>
      </div>
    </section>
  );
}
