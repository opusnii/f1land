import { useMemo, useState } from 'react';
import { useWallet } from '@/store/wallet';
import { useRewards } from '@/store/rewards';
import { useNav } from '@/store/nav';
import { useToasts } from '@/store/toasts';
import { achievements, missions, weekStart, type AchievementState, type MissionState } from '@/demo/progress';
import { SubHeader } from '@/app/Header';
import { useNow } from '@/ui/kit';
import { Obj } from '@/ui/Obj';
import { Tagline } from '@/ui/primitives';
import { IconCheck, IconGift, IconPlay, IconTimer } from '@/ui/icons';
import { HeaderBalance } from '@/ui/profile/HeaderBalance';
import { MISSION_OBJ } from '@/ui/profile/objects';
import { CoinLayer, flyCoins } from '@/ui/celebrate/coins';
import { fmtDuration, fmtNumber, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { Bar, PageHead, Reveal, useBack, useReduced } from './common';
import { AchievementSheet, AchievementsGrid } from './Profile';
import { StreakCard } from '@/ui/celebrate/StreakCard';
import '@/styles/screens/rewards.css';

function MissionRow({ m, claimed, onClaim }: { m: MissionState; claimed: boolean; onClaim: (from: Element) => void }) {
  const name = t(`scr.ms.${m.def.id}`);
  return (
    <div className="card rw-ms" data-done={m.done || undefined} data-claimed={claimed || undefined}>
      <Obj name={MISSION_OBJ[m.def.id] ?? 'coin'} size={48} className="rw-ms__art" />
      <div className="rw-ms__body">
        <b className="rw-ms__t">{name}</b>
        <span className="rw-ms__d">{t(`scr.ms.${m.def.id}.d`, { n: m.def.goal })}</span>
        {!claimed && (
          <span className="rw-ms__prog">
            <Bar value={m.value} max={m.def.goal} label={name} />
            <span className="num">{t('rewards.progress', { a: m.value, b: m.def.goal })}</span>
          </span>
        )}
      </div>
      <div className="rw-ms__cta">
        {claimed ? (
          <span className="rw-ms__got">
            <IconCheck size={14} />
            {t('wallet.claimed')}
          </span>
        ) : m.done ? (
          <button type="button" className="rw-claim num" onClick={(e) => onClaim(e.currentTarget)} aria-label={t('pv2.rw.claim', { n: m.def.reward })}>
            <Obj name="coin" size={20} />+{m.def.reward}
          </button>
        ) : (
          <span className="rw-ms__rw num">
            <Obj name="coin" size={18} />+{m.def.reward}
          </span>
        )}
      </div>
    </div>
  );
}

export function RewardsScreen() {
  const back = useBack();
  const entries = useWallet((s) => s.entries);
  const xp = useWallet((s) => s.xp);
  const lastDaily = useWallet((s) => s.lastDaily);
  const claimed = useRewards((s) => s.claimed);
  const go = useNav((s) => s.go);
  const toast = useToasts((s) => s.push);
  const reduced = useReduced();
  const now = useNow(30_000);
  const [ach, setAch] = useState<AchievementState | null>(null);
  const [announce, setAnnounce] = useState('');
  const list = missions(entries, lastDaily, now);
  const achList = useMemo(() => achievements(entries, xp), [entries, xp]);
  const claimable = list.filter((m) => m.done && !claimed[m.claimKey]);
  const doneCount = list.filter((m) => m.done).length;
  const pot = claimable.reduce((s, m) => s + m.def.reward, 0);
  const resetIn = weekStart(now) + 7 * 86_400_000 - now;

  const claim = (ms: MissionState[], from: Element | null) => {
    const st = useRewards.getState();
    const todo = ms.filter((m) => !st.claimed[m.claimKey]);
    const sum = todo.reduce((s, m) => s + m.def.reward, 0);
    if (!sum) return;
    // Measured before the store update unmounts the pressed button.
    const flying = flyCoins(from, { reduced });
    for (const m of todo) {
      st.markClaimed(m.claimKey);
      useWallet.getState().credit('bonus', m.def.reward);
    }
    haptic.notify('success');
    sfx.checkIn();
    setAnnounce(t('streak.added', { n: fmtNumber(sum) }));
    if (!flying) toast({ kind: 'win', title: t('scr.rewards.claimedToast', { n: fmtNumber(sum) }) });
  };

  return (
    <>
      <SubHeader onBack={back} right={<HeaderBalance />} />
      <div className="rw-head">
        <PageHead title={t('rewards.title')} sub={t('rewards.sub')} />
        <Tagline className="rw-head__tag">{t('tag.rewards')}</Tagline>
      </div>
      <Reveal i={0}>
        <StreakCard />
      </Reveal>
      <section className="section">
        <div className="section__head">
          <h2 className="section__title">
            {t('rewards.missions')} <span className="rw-count num">{doneCount}/{list.length}</span>
          </h2>
          <span className="sc-note">
            <IconTimer size={12} /> {t('scr.rewards.resets', { d: fmtDuration(resetIn) })}
          </span>
        </div>
        {claimable.length > 1 && (
          <button type="button" className="btn btn--block rw-claimall" onClick={(e) => claim(claimable, e.currentTarget)}>
            <IconGift size={18} />
            {t('scr.rewards.claimAll', { n: fmtNumber(pot) })}
          </button>
        )}
        <div className="rw-list">
          {list.map((m, i) => (
            <Reveal key={m.def.id} i={i + 2}>
              <MissionRow m={m} claimed={!!claimed[m.claimKey]} onClaim={(from) => claim([m], from)} />
            </Reveal>
          ))}
        </div>
        {entries.length === 0 && (
          <button type="button" className="btn btn--ghost btn--block rw-start" onClick={() => go('live')}>
            <IconPlay size={16} />
            {t('pv2.rw.start')}
          </button>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t('scr.rewards.badges')}</h2>
          <span className="sc-note num">
            {achList.filter((a) => a.unlocked).length}/{achList.length}
          </span>
        </div>
        <AchievementsGrid list={achList} onOpen={setAch} />
      </section>
      <p className="sc-fine">{t('scr.rewards.note')}</p>
      <AchievementSheet a={ach} onClose={() => setAch(null)} />
      <span className="sr-only" role="status">
        {announce}
      </span>
      <CoinLayer />
    </>
  );
}
