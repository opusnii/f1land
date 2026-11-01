import { useMemo } from 'react';
import { useLive } from '@/store/live';
import { useNav } from '@/store/nav';
import { usePools, multiplier, type LivePool } from '@/demo/poolEngine';
import { levelFromXp, useWallet, type Entry } from '@/store/wallet';
import { fmtCountdown, fmtNumber, fmtOdds, t } from '@/i18n/core';
import { Header } from '@/app/Header';
import { useSessionNow } from '@/app/hooks';
import { layoutOf, poolTexts } from '@/app/poolText';
import { Card, Section } from '@/ui/kit';
import { Obj } from '@/ui/Obj';
import { Tagline } from '@/ui/primitives';
import { IconChevron, IconTrophy } from '@/ui/icons';
import { msUntilLock } from '@/domain/lifecycle';
import { leaderboardWithYou, userPoints } from '@/demo/leaderboard';
import { HomeHero } from '@/ui/home/HomeHero';
import { NextPrediction } from '@/ui/home/NextPrediction';
import { HomeStreak } from '@/ui/home/HomeStreak';
import { MechIcon } from '@/ui/home/mechanics';
import { useYou } from './Profile';
import '@/styles/home.css';

/**
 * Home is a return-visit screen, ordered by what pulls a fan back in:
 * the race happening now, one question to answer next, picks already in play,
 * the daily streak, more open questions, and progress towards the next level.
 */
export function HomeScreen() {
  const live = useLive((s) => s.live);
  const runner = useLive((s) => s.runner);
  const channelId = useLive((s) => s.channelId);
  const go = useNav((s) => s.go);
  const push = useNav((s) => s.push);
  const pools = usePools((s) => s.pools);
  const entries = useWallet((s) => s.entries);
  const now = useSessionNow();

  const open = useMemo(
    () =>
      pools
        .filter((p) => p.pool.status === 'OPEN' && p.pool.intake_status === 'ACCEPTING')
        .sort((a, b) => b.priority - a.priority || Date.parse(a.pool.closes_at) - Date.parse(b.pool.closes_at)),
    [pools],
  );
  const featured = open[0] ?? null;
  const pending = entries.filter((e) => e.state === 'PENDING');
  const openPool = (lp: LivePool) => push({ name: 'pool', channelId, poolId: lp.pool.pool_id });

  return (
    <div className="home">
      <Header />

      <HomeHero onOpen={() => go('live')} />

      <Section title={t('home3.next')}>
        {featured ? (
          <NextPrediction lp={featured} now={now} onOpen={() => openPool(featured)} />
        ) : live ? (
          <Card className="hm-empty" onClick={() => go('live')} ariaLabel={t('home3.noPools')}>
            <span>{t('home3.noPools')}</span>
            <IconChevron size={16} />
          </Card>
        ) : (
          <div className="skel hm-skel" aria-hidden="true" />
        )}
      </Section>

      {pending.length > 0 && (
        <Section title={t('home3.inPlay')} action={<span className="hm-count num">{pending.length}</span>}>
          <Card pad={false} className="hm-list">
            {pending.slice(0, 3).map((e) => (
              <PickRow key={e.id} e={e} onOpen={() => push({ name: 'entry', entryId: e.id })} />
            ))}
            {pending.length > 3 && (
              <button type="button" className="hm-more" onClick={() => go('pools')}>
                {t('home3.allPicks', { n: pending.length })}
                <IconChevron size={14} />
              </button>
            )}
          </Card>
        </Section>
      )}

      <HomeStreak />

      {open.length > 1 && (
        <Section
          title={t('home3.open')}
          action={
            <button type="button" className="link-btn" onClick={() => go('live')}>
              {t('home3.all')} <IconChevron size={14} />
            </button>
          }
        >
          <Card pad={false} className="hm-list">
            {open.slice(1, 5).map((lp) => (
              <PoolRow key={lp.pool.pool_id} lp={lp} now={now} onOpen={() => openPool(lp)} />
            ))}
          </Card>
        </Section>
      )}

      <ProgressCard onOpen={() => push({ name: 'leaderboard' })} />

      <Tagline className="home__tagline">{t('tag.home')}</Tagline>
      <p className="home__note muted">{runner ? t('app.demoNote') : t('home2.loadingSession')}</p>
    </div>
  );
}

function PickRow({ e, onOpen }: { e: Entry; onOpen: () => void }) {
  const tx = poolTexts(e.pool);
  return (
    <button type="button" className="hm-row" onClick={onOpen}>
      <MechIcon family={layoutOf(e.pool)} size={22} className="hm-row__icon" />
      <span className="hm-row__main">
        <span className="hm-row__q">{tx.question}</span>
        <span className="hm-row__sub ellipsis">
          {e.outcomeLabel} · <span className="num">{fmtNumber(e.stake)}</span>
        </span>
      </span>
      <span className="hm-row__side num">≈{fmtNumber(Math.round(e.stake * e.estimate))}</span>
      <IconChevron size={14} />
    </button>
  );
}

function PoolRow({ lp, now, onOpen }: { lp: LivePool; now: number; onOpen: () => void }) {
  const tx = poolTexts(lp.pool);
  const ms = msUntilLock(lp.pool, now);
  const best = Math.max(...lp.pool.outcomes.map((o) => multiplier(lp.book, o.id)));
  return (
    <button type="button" className="hm-row" onClick={onOpen}>
      <MechIcon family={layoutOf(lp.pool)} size={22} className="hm-row__icon" />
      <span className="hm-row__main">
        <span className="hm-row__q">{tx.question}</span>
        <span className="hm-row__sub ellipsis">
          {tx.title} · <span className={`num ${ms < 10_000 ? 'hm-urgent' : ''}`}>{fmtCountdown(ms)}</span>
        </span>
      </span>
      {Number.isFinite(best) && best < 50 && <span className="hm-row__side num">{t('home2.upTo', { x: fmtOdds(best) })}</span>}
      <IconChevron size={14} />
    </button>
  );
}

function ProgressCard({ onOpen }: { onOpen: () => void }) {
  const xp = useWallet((s) => s.xp);
  const entries = useWallet((s) => s.entries);
  const you = useYou();
  const lvl = levelFromXp(xp);
  const rank = useMemo(() => {
    const at = Date.now();
    return leaderboardWithYou('season', at, you, userPoints(entries, xp, 'season', at)).rank;
  }, [entries, xp, you.name, you.driverId]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = Math.round((lvl.into / Math.max(1, lvl.need)) * 100);
  return (
    <Card className="hm-prog" onClick={onOpen} ariaLabel={`${t('shell.level', { n: lvl.level })}. ${t('home3.rank')} #${rank}`}>
      <span className="hm-prog__lvl">
        <Obj name="level" size={48} />
        <b className="num">{lvl.level}</b>
      </span>
      <span className="hm-prog__main">
        <span className="hm-prog__top">
          <b>{t('hl.prog.level', { n: lvl.level })}</b>
          <span className="num muted">{t('home3.toLevel', { n: fmtNumber(lvl.need - lvl.into), l: lvl.level + 1 })}</span>
        </span>
        <span className="hm-prog__bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      </span>
      <span className="hm-prog__rank">
        <span className="num">
          <IconTrophy size={13} />#{rank}
        </span>
        <small>{t('home3.rank')}</small>
      </span>
    </Card>
  );
}
