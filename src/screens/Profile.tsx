import { useMemo, useState } from 'react';
import { useWallet, levelFromXp } from '@/store/wallet';
import { useSettings } from '@/store/settings';
import { useNav } from '@/store/nav';
import { useRewards } from '@/store/rewards';
import { DRIVERS, DRIVER_BY_ID, TEAMS, TEAM_BY_ID } from '@/data/teams';
import { achievements, missions, playerStats, type AchievementState } from '@/demo/progress';
import { leaderboardWithYou, userPoints } from '@/demo/leaderboard';
import { Header } from '@/app/Header';
import { Card, DriverAvatar, Sparkline } from '@/ui/kit';
import { Helmet } from '@/ui/Helmet';
import { Obj } from '@/ui/Obj';
import { AchBadge, LevelBadge } from '@/ui/profile/objects';
import { IconArrow, IconCheck, IconChevron, IconLock, IconStar } from '@/ui/icons';
import { fmtNumber, t } from '@/i18n/core';
import { telegramUser, haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { Bar, MenuRow, PortalSheet, Reveal, signed } from './common';

export function useYou() {
  const user = telegramUser();
  const fav = useSettings((s) => s.favoriteDriver);
  return { id: 'you', name: user?.name || t('profile.guest'), username: user?.username, photo: user?.photo, premium: user?.premium, driverId: fav ?? 'nor', countryCode: '', winRate: 0 };
}

export function AchievementsGrid({ list, onOpen }: { list: AchievementState[]; onOpen: (a: AchievementState) => void }) {
  return (
    <ul className="pf-badges">
      {list.map((a) => (
        <li key={a.def.id}>
          <button type="button" className="pf-badge" data-on={a.unlocked || undefined} onClick={() => onOpen(a)} aria-label={`${t(`scr.ach.${a.def.id}`)}${a.unlocked ? '' : ` — ${t('scr.locked')}`}`}>
            <AchBadge a={a} size={56} />
            <span className="pf-badge__t">{t(`scr.ach.${a.def.id}`)}</span>
            {!a.unlocked && a.progress > 0 && (
              <span className="pf-badge__p" aria-hidden="true">
                <i style={{ width: `${Math.round(a.progress * 100)}%` }} />
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AchievementSheet({ a, onClose }: { a: AchievementState | null; onClose: () => void }) {
  return (
    <PortalSheet open={!!a} onClose={onClose} label={t('profile.achievements')} title={t('profile.achievements')}>
      {a && (
        <div className="pf-achd" data-on={a.unlocked || undefined}>
          <AchBadge a={a} size={112} label />
          <h3>{t(`scr.ach.${a.def.id}`)}</h3>
          <p>{t(`scr.ach.${a.def.id}.d`, { n: a.def.goal })}</p>
          <Bar value={Math.min(a.value, a.def.goal)} max={a.def.goal} tone={a.unlocked ? 'lime' : a.def.tone} label={t(`scr.ach.${a.def.id}`)} />
          <div className="pf-achd__p num">{t('rewards.progress', { a: fmtNumber(Math.min(a.value, a.def.goal)), b: fmtNumber(a.def.goal) })}</div>
          <span className={`badge ${a.unlocked ? 'badge--lime' : 'badge--ghost'}`}>
            {a.unlocked ? <IconCheck size={12} /> : <IconLock size={12} />}
            {a.unlocked ? t('scr.unlocked') : t('scr.locked')}
          </span>
        </div>
      )}
    </PortalSheet>
  );
}

export function DriverPickerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fav = useSettings((s) => s.favoriteDriver);
  const set = useSettings((s) => s.set);
  const pick = (id: string | null) => {
    haptic.impact('light');
    sfx.select();
    set({ favoriteDriver: id });
    onClose();
  };
  return (
    <PortalSheet open={open} onClose={onClose} label={t('profile.favorite')} title={t('profile.favorite')}>
      <p className="sc-fine" style={{ marginTop: 0 }}>
        {t('scr.profile.favHint')}
      </p>
      <div className="sc-pick">
        {TEAMS.map((team) => (
          <div key={team.id} className="sc-pick__team">
            <div className="sc-pick__tname" style={{ ['--team' as string]: team.color }}>
              {team.name}
            </div>
            <div className="sc-pick__row">
              {DRIVERS.filter((d) => d.teamId === team.id).map((d) => (
                <button key={d.id} className="sc-pick__d" aria-pressed={fav === d.id} onClick={() => pick(d.id)} style={{ ['--team' as string]: team.color }}>
                  <DriverAvatar id={d.id} size={34} />
                  <span className="sc-pick__txt">
                    <b>{d.code}</b>
                    <span className="ellipsis">{d.lastName}</span>
                  </span>
                  {fav === d.id && <IconCheck size={14} className="icon lime" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {fav && (
        <button className="btn btn--ghost btn--block" style={{ marginTop: 12 }} onClick={() => pick(null)}>
          {t('scr.profile.noFav')}
        </button>
      )}
    </PortalSheet>
  );
}

export function ProfileScreen() {
  const entries = useWallet((s) => s.entries);
  const xp = useWallet((s) => s.xp);
  const balance = useWallet((s) => s.balance);
  const lastDaily = useWallet((s) => s.lastDaily);
  const claimed = useRewards((s) => s.claimed);
  const fav = useSettings((s) => s.favoriteDriver);
  const push = useNav((s) => s.push);
  const you = useYou();
  const [pickOpen, setPickOpen] = useState(false);
  const [ach, setAch] = useState<AchievementState | null>(null);
  const stats = useMemo(() => playerStats(entries), [entries]);
  const lvl = levelFromXp(xp);
  const achList = useMemo(() => achievements(entries, xp), [entries, xp]);
  const unlocked = achList.filter((a) => a.unlocked).length;
  const now = useMemo(() => Date.now(), []);
  const rank = useMemo(() => leaderboardWithYou('season', now, you, userPoints(entries, xp, 'season', now)).rank, [entries, xp, now, you.name, you.driverId]);
  const claimable = missions(entries, lastDaily, now).filter((m) => m.done && !claimed[m.claimKey]).length;
  const favD = fav ? DRIVER_BY_ID[fav] : undefined;
  const favTeam = favD ? TEAM_BY_ID[favD.teamId] : undefined;
  const go = useNav((s) => s.go);
  // The closest locked achievement leads; the strip shows the rest, unlocked first.
  const next = useMemo(() => achList.filter((a) => !a.unlocked).sort((x, y) => y.progress - x.progress)[0] ?? null, [achList]);
  const rest = useMemo(() => achList.filter((a) => a !== next).sort((x, y) => Number(y.unlocked) - Number(x.unlocked) || y.progress - x.progress), [achList, next]);
  const profitTone = stats.profit > 0 ? 'lime' : stats.profit < 0 ? 'red' : '';
  const openPicker = () => {
    haptic.tap();
    setPickOpen(true);
  };
  let i = 0;
  return (
    <>
      <Header />
      <Reveal i={i++}>
        <section className="card pf-hero" style={favTeam ? { ['--team' as string]: favTeam.color } : undefined} data-fav={favD ? '' : undefined}>
          {favD && (
            <span className="pf-hero__num" aria-hidden="true">
              {favD.number}
            </span>
          )}
          <div className="pf-hero__top">
            <button type="button" className="pf-hero__av" aria-label={t('profile.favorite')} onClick={openPicker}>
              {you.photo ? <img src={you.photo} alt="" /> : <Helmet driverId={you.driverId} size={72} num={!!favD} decorative />}
            </button>
            <div className="pf-hero__who">
              <h1 className="pf-hero__name">
                <span className="ellipsis">{you.name}</span>
                {you.premium && <IconStar size={15} className="icon yellow" />}
              </h1>
              <button type="button" className="pf-hero__fan" onClick={openPicker}>
                {favD ? (
                  <span className="ellipsis">
                    {favD.lastName} <span className="muted">· {favTeam?.shortName}</span>
                  </span>
                ) : (
                  <span className="lime">{t('pf.pickDriver')}</span>
                )}
                <IconChevron size={14} />
              </button>
              <span className="sc-pill sc-pill--demo">{t('scr.profile.demoAccount')}</span>
            </div>
          </div>
          <div className="pf-hero__lvl">
            <LevelBadge level={lvl.level} size={56} />
            <div className="pf-hero__lvlbody">
              <div className="pf-hero__lvlrow">
                <b>{t('profile.level', { n: lvl.level })}</b>
                <button type="button" className="pf-hero__rank num" onClick={() => (haptic.tap(), push({ name: 'leaderboard' }))}>
                  <Obj name="trophy-gold" size={20} />
                  {t('pf.rank', { n: rank })}
                </button>
              </div>
              <Bar value={lvl.into} max={lvl.need} label={t('profile.level', { n: lvl.level })} />
              <div className="pf-hero__xp">
                <span>{t('pf.toLevel', { n: fmtNumber(lvl.need - lvl.into), l: lvl.level + 1 })}</span>
                <span className="num">
                  {fmtNumber(lvl.into)}/{fmtNumber(lvl.need)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal i={i++} className="section">
        <div className="section__head">
          <h2 className="section__title">{t('profile.stats')}</h2>
        </div>
        {stats.total === 0 ? (
          <div className="card pf-first">
            <Obj name="empty-picks" size={64} className="pf-first__art" />
            <span className="pf-first__txt">
              <b>{t('pf.first.title')}</b>
              <small>{t('pf.first.sub')}</small>
            </span>
            <button type="button" className="btn btn--primary btn--block" onClick={() => (haptic.tap(), go('live'))}>
              {t('pf.first.cta')}
              <IconArrow size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="card pf-stats">
              <div className="pf-stat">
                <span className="pf-stat__v num">{stats.total}</span>
                <span className="pf-stat__k">{t('profile.entries')}</span>
              </div>
              <div className="pf-stat">
                <span className="pf-stat__v num">{stats.winRate === null ? '—' : `${Math.round(stats.winRate * 100)}%`}</span>
                <span className="pf-stat__k">{t('profile.winRate')}</span>
              </div>
              <div className="pf-stat">
                <span className={`pf-stat__v num ${profitTone}`}>{signed(stats.profit, (n) => fmtNumber(n))}</span>
                <span className="pf-stat__k">{t('profile.profit')}</span>
              </div>
            </div>
            {stats.profitSeries.length > 2 && (
              <Card className="pf-spark">
                <div>
                  <div className="pf-spark__k">{t('scr.profile.profitCurve')}</div>
                  <div className={`pf-spark__v num ${profitTone}`}>{signed(stats.profit, (n) => fmtNumber(n))} PULSE</div>
                </div>
                <Sparkline values={stats.profitSeries} color={stats.profit >= 0 ? 'var(--lime)' : 'var(--red)'} width={130} height={42} />
              </Card>
            )}
          </>
        )}
      </Reveal>

      <Reveal i={i++} className="section">
        <div className="section__head">
          <h2 className="section__title">{t('profile.achievements')}</h2>
          <span className="sc-note num">
            {unlocked}/{achList.length}
          </span>
        </div>
        {next && (
          <button type="button" className="card pf-next" onClick={() => setAch(next)}>
            <AchBadge a={next} size={64} />
            <span className="pf-next__body">
              <span className="pf-next__k">{t('pv2.pf.nextBadge')}</span>
              <b>{t(`scr.ach.${next.def.id}`)}</b>
              <small>{t(`scr.ach.${next.def.id}.d`, { n: next.def.goal })}</small>
              <span className="pf-next__bar" aria-hidden="true">
                <i style={{ width: `${Math.max(4, Math.round(next.progress * 100))}%` }} />
              </span>
            </span>
            <span className="pf-next__v num">
              {fmtNumber(Math.min(next.value, next.def.goal))}/{fmtNumber(next.def.goal)}
            </span>
          </button>
        )}
        <AchievementsGrid list={rest} onOpen={setAch} />
      </Reveal>

      <Reveal i={i++} className="section">
        <div className="sc-menu-list">
          <MenuRow art="coin-stack" title={t('profile.wallet')} sub={t('wallet.sub')} value={fmtNumber(balance)} onClick={() => push({ name: 'wallet' })} />
          <MenuRow art="stopwatch" title={t('profile.history')} sub={t('scr.profile.historySub')} value={stats.total} onClick={() => push({ name: 'history' })} />
          <MenuRow art="trophy-gold" title={t('profile.leaderboard')} sub={t('lb.sub')} value={`#${rank}`} onClick={() => push({ name: 'leaderboard' })} />
          <MenuRow art="gift" title={t('profile.rewards')} sub={t('rewards.sub')} badge={claimable > 0 ? <span className="sc-dotbadge num">{claimable}</span> : undefined} onClick={() => push({ name: 'rewards' })} />
          <MenuRow art="steering-wheel" title={t('profile.settings')} sub={t('scr.profile.settingsSub')} onClick={() => push({ name: 'settings' })} />
        </div>
        <p className="sc-fine">{t('pv2.demo')}</p>
      </Reveal>

      <DriverPickerSheet open={pickOpen} onClose={() => setPickOpen(false)} />
      <AchievementSheet a={ach} onClose={() => setAch(null)} />
    </>
  );
}
