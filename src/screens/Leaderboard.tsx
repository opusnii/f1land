import { useMemo, useState, type CSSProperties } from 'react';
import { useWallet } from '@/store/wallet';
import { useNav } from '@/store/nav';
import { leaderboardWithYou, userPoints, type LbPeriod, type LbPlayer } from '@/demo/leaderboard';
import { weekStart } from '@/demo/progress';
import { SubHeader } from '@/app/Header';
import { Segmented, useNow } from '@/ui/kit';
import { Helmet } from '@/ui/Helmet';
import { Flag, Obj } from '@/ui/Obj';
import { IconArrow, IconTimer } from '@/ui/icons';
import { PODIUM_TROPHY } from '@/ui/profile/objects';
import { fmtDuration, fmtNumber, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { PageHead, Reveal, useBack, useReduced } from './common';
import { useYou } from './Profile';
import '@/styles/screens/leaderboard.css';

type Player = LbPlayer & { photo?: string };

function Trend({ n }: { n: number }) {
  if (n === 0) return <span className="lb-trend">–</span>;
  return (
    <span className={`lb-trend ${n > 0 ? 'lb-trend--up' : 'lb-trend--down'}`}>
      {n > 0 ? '▲' : '▼'}
      {Math.abs(n)}
    </span>
  );
}

function Avatar({ p, size }: { p: Player; size: number }) {
  return p.photo ? <img src={p.photo} alt="" className="lb-photo" style={{ width: size, height: size }} /> : <Helmet driverId={p.driverId} size={size} num={false} decorative />;
}

const STEP_H: Record<number, number> = { 1: 104, 2: 80, 3: 64 };
const TROPHY_SIZE: Record<number, number> = { 1: 56, 2: 44, 3: 40 };

function Podium({ top, reduced }: { top: Player[]; reduced: boolean }) {
  const order = [top[1], top[0], top[2]].filter(Boolean) as Player[];
  return (
    <ol className="lb-podium">
      {order.map((p, i) => {
        const n = top.indexOf(p) + 1;
        return (
          <li key={p.id} className="lb-podium__col" data-place={n} data-you={p.you || undefined} style={{ '--d': `${reduced ? 0 : 0.08 + i * 0.07}s` } as CSSProperties} aria-label={`${t('pv2.lb.place', { n })}: ${p.you ? t('lb.you') : p.name}, ${fmtNumber(p.points)} ${t('lb.points')}`}>
            <span className="lb-podium__who" aria-hidden="true">
              <Avatar p={p} size={n === 1 ? 64 : 52} />
              <b className="lb-podium__name">{p.you ? t('lb.you') : p.name}</b>
              <span className="lb-podium__pts num">
                {fmtNumber(p.points)} <i>{t('lb.points')}</i>
              </span>
            </span>
            <span className="lb-podium__step" style={{ height: STEP_H[n] }} aria-hidden="true">
              <Obj name={PODIUM_TROPHY[n - 1]!} size={TROPHY_SIZE[n]} className="lb-podium__trophy" />
              <span className="lb-podium__n num">{n}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ p, rank }: { p: Player; rank: number }) {
  return (
    <div className="lb-row" data-you={p.you || undefined}>
      <span className="lb-row__rank num">{rank}</span>
      <Trend n={p.trend} />
      <Avatar p={p} size={32} />
      <span className="lb-row__name">
        <span className="lb-row__who">
          <b>{p.you ? `${p.name} · ${t('lb.you')}` : p.name}</b>
          {p.countryCode && <Flag cc={p.countryCode} size={16} />}
        </span>
        <span className="lb-row__sub">{p.you ? t('scr.lb.yourScore') : t('scr.lb.acc', { n: Math.round(p.winRate * 100) })}</span>
      </span>
      <span className="lb-row__pts num">
        {fmtNumber(p.points)}
        <i>{t('lb.points')}</i>
      </span>
    </div>
  );
}

export function LeaderboardScreen() {
  const back = useBack();
  const entries = useWallet((s) => s.entries);
  const xp = useWallet((s) => s.xp);
  const go = useNav((s) => s.go);
  const you = useYou();
  const reduced = useReduced();
  const [period, setPeriod] = useState<LbPeriod>('week');
  const now = useNow(30_000);
  const hour = Math.floor(now / 3_600_000);
  const { list, rank } = useMemo(() => {
    const r = leaderboardWithYou(period, now, you, userPoints(entries, xp, period, now));
    return { list: r.list.map((p) => (p.you ? { ...p, photo: you.photo } : p)), rank: r.rank };
    // `now` only matters at hour granularity here; `hour` keeps the list stable between ticks.
  }, [period, hour, entries, xp, you.name, you.driverId, you.photo]);
  const top = list.slice(0, 3);
  const rest = list.slice(3, 50);
  const me = list[rank - 1]!;
  const resetIn = weekStart(now) + 7 * 86_400_000 - now;
  const pct = Math.max(1, Math.round((rank / list.length) * 100));
  const unranked = me.points === 0;
  return (
    <>
      <SubHeader onBack={back} />
      <PageHead title={t('lb.title')} sub={t('lb.sub')} />
      <Segmented<LbPeriod>
        label={t('lb.title')}
        value={period}
        onChange={setPeriod}
        options={[
          { id: 'week', label: t('lb.week') },
          { id: 'season', label: t('lb.season') },
          { id: 'friends', label: t('lb.friends') },
        ]}
      />
      <div className="lb-meta">
        <span>
          <IconTimer size={13} />
          {period === 'week' ? t('scr.lb.resets', { d: fmtDuration(resetIn) }) : period === 'season' ? t('scr.lb.seasonNote') : t('scr.lb.friendsNote')}
        </span>
        <span className="num">{t('scr.lb.players', { n: fmtNumber(list.length) })}</span>
      </div>
      <section className="card lb-podium-card" key={period} data-reduced={reduced || undefined} aria-label={t('lb.title')}>
        <Podium top={top} reduced={reduced} />
      </section>
      <div className="card lb-list" key={`l-${period}`}>
        {rest.map((p, i) => (
          <Reveal key={p.id} i={i}>
            <Row p={p} rank={i + 4} />
          </Reveal>
        ))}
      </div>
      {rank > 3 && (
        <div className="lb-pin">
          <Row p={me} rank={rank} />
          {unranked ? (
            <button
              type="button"
              className="lb-pin__note lb-pin__note--cta"
              onClick={() => {
                haptic.tap();
                go('live');
              }}
            >
              {t('pv2.lb.noRank')}
              <IconArrow size={14} />
            </button>
          ) : (
            <div className="lb-pin__note">{rank <= 50 ? t('scr.lb.inTop') : t('scr.lb.topPct', { n: pct })}</div>
          )}
        </div>
      )}
      <p className="sc-fine">{t('scr.lb.demoNote')}</p>
    </>
  );
}
