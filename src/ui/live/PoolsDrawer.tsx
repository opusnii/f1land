/* Live drawer, Pools tab (spec §9.2): the first open pool is featured on its mechanic plate, the rest are rows. */
import { memo } from 'react';
import { useLive } from '@/store/live';
import { useNav } from '@/store/nav';
import { useWallet } from '@/store/wallet';
import { multiplier, usePools, type LivePool } from '@/demo/poolEngine';
import { poolPlate } from '@/assets';
import { fmtNumber, fmtOdds, t } from '@/i18n/core';
import { msUntilLock } from '@/domain/lifecycle';
import { layoutOf, outcomeShort, poolTexts } from '@/app/poolText';
import { useSessionNow } from '@/app/hooks';
import { Art } from '@/ui/Art';
import { DisplayTitle, StatusChip } from '@/ui/primitives';
import { LockTimer } from '@/ui/LockTimer';
import { IconArrow, IconChevron } from '@/ui/icons';
import { haptic } from '@/telegram/sdk';
import { MechIcon, mechName, outcomeVisual } from '@/ui/home/mechanics';

function timing(lp: LivePool, now: number) {
  const ms = msUntilLock(lp.pool, now);
  const total = Date.parse(lp.pool.closes_at) - Date.parse(lp.pool.opens_at);
  const accept = lp.pool.status === 'OPEN' && lp.pool.intake_status === 'ACCEPTING' && ms > 0;
  return { ms, total, accept };
}

function pressable(onOpen: () => void) {
  const go = () => {
    haptic.tap();
    onOpen();
  };
  return {
    role: 'button',
    tabIndex: 0,
    onClick: go,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    },
  } as const;
}

export const FeaturedPool = memo(function FeaturedPool({ lp, now, onOpen }: { lp: LivePool; now: number; onOpen: () => void }) {
  const tx = poolTexts(lp.pool);
  const family = layoutOf(lp.pool);
  const mine = useWallet((s) => s.entries.some((e) => e.poolId === lp.pool.pool_id));
  const { ms, total, accept } = timing(lp, now);
  const top = [...lp.pool.outcomes]
    .map((o) => ({ o, m: multiplier(lp.book, o.id) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, 3);
  const bank = Object.values(lp.book.stakes).reduce((a, b) => a + b, 0);
  return (
    <article className="pf" aria-label={`${tx.title}. ${tx.question}`} {...pressable(onOpen)}>
      <Art name={poolPlate(family)} scrim="l" focal="75% 50%" sizes="(max-width: 480px) 100vw, 480px" className="pf__art" />
      <div className="pf__head">
        <DisplayTitle as="h3" size="sm" icon={<MechIcon family={family} size={18} />}>
          {mechName(family)}
        </DisplayTitle>
        {mine && <span className="pf__mine">{t('lv.youreIn')}</span>}
        <LockTimer variant="ring" size={40} ms={ms} totalMs={total} accept={accept} status={lp.pool.status} className="pf__timer" />
      </div>
      <p className="pf__q">{tx.question}</p>
      <div className="pf__outs">
        {top.map(({ o, m }) => (
          <span key={o.id} className="tile pf__out">
            <span className="pf__vis" aria-hidden="true">
              {outcomeVisual(o, lp.pool, 22)}
            </span>
            <span className="pf__out-l">{outcomeShort(o, lp.pool)}</span>
            <b className="num">×{fmtOdds(m)}</b>
          </span>
        ))}
      </div>
      <div className="pf__foot">
        <span className="pf__meta">{t('hl.next.meta', { bank: fmtNumber(bank), n: fmtNumber(lp.book.players) })}</span>
        <span className="btn btn--primary btn--sm pf__cta">
          {t('hl.pools.predict')} <IconArrow size={15} />
        </span>
      </div>
    </article>
  );
});

export const PoolRow = memo(function PoolRow({ lp, now, onOpen }: { lp: LivePool; now: number; onOpen: () => void }) {
  const tx = poolTexts(lp.pool);
  const family = layoutOf(lp.pool);
  const mine = useWallet((s) => s.entries.some((e) => e.poolId === lp.pool.pool_id));
  const { ms, total, accept } = timing(lp, now);
  const open = lp.pool.status === 'OPEN';
  const best = open ? Math.max(...lp.pool.outcomes.map((o) => multiplier(lp.book, o.id))) : NaN;
  return (
    <div className={`pr ${mine ? 'pr--mine' : ''}`} aria-label={`${tx.title}. ${tx.question}`} {...pressable(onOpen)}>
      {open ? <LockTimer variant="ring" size={36} ms={ms} totalMs={total} accept={accept} status={lp.pool.status} className="pr__timer" /> : <MechIcon family={family} size={22} className="pr__icon" />}
      <span className="pr__main">
        <span className="pr__kicker">
          {open && <MechIcon family={family} size={14} />}
          <span className="pr__title">{tx.title}</span>
          {mine && <span className="pf__mine">{t('lv.youreIn')}</span>}
        </span>
        <span className="pr__q">{tx.question}</span>
      </span>
      {open ? Number.isFinite(best) && best < 50 && <span className="pr__odds num">{t('home2.upTo', { x: fmtOdds(best) })}</span> : <StatusChip status={lp.pool.status} accept={false} className="pr__status" />}
      <IconChevron size={14} className="pr__chev" />
    </div>
  );
});

function GroupHead({ label, count }: { label: string; count: number }) {
  return (
    <h4 className="lv-group">
      <span>{label}</span>
      <b className="num">{count}</b>
    </h4>
  );
}

/** `layout` is kept for compatibility: the peek snap shows the featured card, larger snaps scroll into the rows. */
export function PoolsTab({ layout: _layout }: { layout: 'strip' | 'list' }) {
  const pools = usePools((s) => s.pools);
  const channelId = useLive((s) => s.channelId);
  const push = useNav((s) => s.push);
  const now = useSessionNow();
  const open = pools.filter((p) => p.pool.status === 'OPEN').sort((a, b) => b.priority - a.priority || Date.parse(a.pool.closes_at) - Date.parse(b.pool.closes_at));
  const pending = pools.filter((p) => p.pool.status === 'LOCKED' || p.pool.status === 'RESOLVING').slice(-6).reverse();
  const done = pools.filter((p) => p.pool.status === 'SETTLED' || p.pool.status === 'VOID').slice(-4).reverse();
  const openPool = (lp: LivePool) => push({ name: 'pool', channelId, poolId: lp.pool.pool_id });
  if (!open.length && !pending.length && !done.length) {
    return (
      <div className="lv-empty">
        <span className="lv-empty__pulse" />
        {t('pool.noPools')}
      </div>
    );
  }
  const [featured, ...rest] = open;
  return (
    <div className="pc-list">
      {featured ? <FeaturedPool lp={featured} now={now} onOpen={() => openPool(featured)} /> : <div className="lv-empty">{t('pool.noPools')}</div>}
      {rest.length > 0 && <GroupHead label={t('hl.pools.more')} count={rest.length} />}
      {rest.length > 0 && (
        <div className="pr-list">
          {rest.map((lp) => (
            <PoolRow key={lp.pool.pool_id} lp={lp} now={now} onOpen={() => openPool(lp)} />
          ))}
        </div>
      )}
      {pending.length > 0 && <GroupHead label={t('pool.resolving')} count={pending.length} />}
      {pending.length > 0 && (
        <div className="pr-list">
          {pending.map((lp) => (
            <PoolRow key={lp.pool.pool_id} lp={lp} now={now} onOpen={() => openPool(lp)} />
          ))}
        </div>
      )}
      {done.length > 0 && <GroupHead label={t('pool.settled')} count={done.length} />}
      {done.length > 0 && (
        <div className="pr-list">
          {done.map((lp) => (
            <PoolRow key={lp.pool.pool_id} lp={lp} now={now} onOpen={() => openPool(lp)} />
          ))}
        </div>
      )}
    </div>
  );
}
