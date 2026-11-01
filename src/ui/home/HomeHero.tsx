import { memo, useMemo } from 'react';
import { useLive } from '@/store/live';
import { CHANNELS } from '@/demo/channels';
import { CIRCUIT_META } from '@/data/circuits';
import { DRIVER_BY_ID } from '@/data/teams';
import { circuitPlate } from '@/assets';
import { fmtCountdown, fmtGap, fmtLap, getLang, t } from '@/i18n/core';
import { useMapCars } from '@/app/hooks';
import { Art } from '@/ui/Art';
import { Helmet } from '@/ui/Helmet';
import { TrackMap, type MapCar } from '@/ui/TrackMap';
import { IconArrow } from '@/ui/icons';
import { haptic } from '@/telegram/sdk';

/**
 * "Live now" hero (spec §9.1, S3): the broadcast's circuit plate under a glass top-3 and the neon
 * mini-track with only the leader and the followed car. The whole plate opens the Live tab.
 */
export const HomeHero = memo(function HomeHero({ onOpen }: { onOpen: () => void }) {
  const live = useLive((s) => s.live);
  const runner = useLive((s) => s.runner);
  const progress = useLive((s) => s.progress);
  const channelId = useLive((s) => s.channelId);
  const followId = useLive((s) => s.followId);
  const lang = getLang();
  const channel = CHANNELS.find((c) => c.id === channelId)!;
  const meta = CIRCUIT_META.find((c) => c.id === channel.circuitId);
  const circuit = runner?.circuit;
  const isQuali = channel.sessionType === 'QUALIFYING' || channel.sessionType === 'SPRINT_QUALIFYING';
  const leaderId = live?.cars[0]?.id ?? null;
  const all = useMapCars(live, followId, null, leaderId ? [leaderId] : []);
  const cars = useMemo(
    () =>
      all
        .filter((c) => c.id === leaderId || c.kind === 'follow')
        // One tag only: the followed car's when there is one, so tags never collide on the thumbnail.
        .map((c): MapCar => ({ ...c, kind: c.kind === 'follow' ? 'follow' : 'near', tag: c.kind === 'follow' || !followId ? `P${c.position ?? ''} ${DRIVER_BY_ID[c.id]?.code ?? ''}` : '' })),
    [all, leaderId, followId],
  );
  const neutral = live && live.trackState !== 'GREEN' && live.trackState !== 'CHEQUERED' ? live.trackState : null;
  const title = channel.title[lang];
  const open = () => {
    haptic.tap();
    onOpen();
  };

  return (
    <section
      className="hm-hero"
      role="button"
      tabIndex={0}
      aria-label={`${t('home.liveNow')}: ${title}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <Art name={circuitPlate(channel.circuitId)} priority focal="50% 45%" sizes="(max-width: 480px) calc(100vw - 32px), 448px" className="hm-hero__art" />
      <div className="hm-hero__top">
        <span className="hm-hero__live techlabel">
          <i aria-hidden="true" /> LIVE
        </span>
        {live && !isQuali && live.totalLaps !== null && (
          <span className="hm-hero__lap">
            <span className="techlabel">{t('live.lap')}</span>
            <b className="num">{Math.max(1, Math.min(live.leaderLap, live.totalLaps))}</b>
            <span className="num">/{live.totalLaps}</span>
          </span>
        )}
        {live?.segment && (
          <span className="hm-hero__lap">
            <span className="techlabel">{live.segment.id}</span>
            <b className="num">{fmtCountdown(live.segment.remainingMs)}</b>
          </span>
        )}
      </div>
      <h2 className="hm-hero__title">{title}</h2>
      <p className="hm-hero__sub">
        <span>{meta?.shortName ?? circuit?.name}</span>
        {neutral && <span className={`hm-hero__flag hm-hero__flag--${neutral === 'RED' ? 'red' : 'sc'}`}>{t(`rc.${neutral}`)}</span>}
      </p>
      <div className="hm-hero__body">
        <ol className="hm-tower card--glass" aria-label={t('home.liveTiming')}>
          {live
            ? live.cars.slice(0, 3).map((c) => (
                <li key={c.id} className={c.id === followId ? 'hm-tower__on' : undefined}>
                  <span className="num hm-tower__pos">{c.position}</span>
                  <Helmet driverId={c.id} size={24} num={false} decorative />
                  <b>{DRIVER_BY_ID[c.id]?.code}</b>
                  <span className="num hm-tower__gap">{c.position === 1 ? (isQuali ? fmtLap(c.segmentBestMs ?? null) : t('home2.leader')) : c.gapMs !== null ? fmtGap(c.gapMs, 1) : '—'}</span>
                </li>
              ))
            : [0, 1, 2].map((i) => <li key={i} className="skel hm-tower__skel" />)}
        </ol>
        <div className="hm-hero__map">
          {circuit ? (
            <TrackMap variant="neon" circuit={circuit} cars={cars} width={180} height={124} padding={14} showPit={false} stale={live?.stale} className="hm-hero__svg" />
          ) : (
            <span className="hm-hero__sync num">
              {t('ui.syncing')} {Math.round(progress * 100)}%
            </span>
          )}
        </div>
      </div>
      <div className="hm-hero__foot">
        <span className="hm-hero__approx">{t('hl.hero.approx')}</span>
        <span className="hm-hero__go">
          {t('home3.watch')} <IconArrow size={15} />
        </span>
      </div>
    </section>
  );
});
