/* What a settlement changed for the player: level, badges, season rank. Read once when the moment mounts. */
import { useEffect, useState } from 'react';
import { useRewards } from '@/store/rewards';
import { levelFromXp, useWallet } from '@/store/wallet';
import { achievements, type AchievementState } from '@/demo/progress';
import { fmtNumber, plural, t } from '@/i18n/core';
import { currentSeasonStanding, useCelebrate, type QueuedMoment } from './store';

export interface LevelUp {
  from: number;
  to: number;
}

export interface Extras {
  levelUp: LevelUp | null;
  level: number;
  xpFrom: number;
  xpTo: number;
  xpLeft: number;
  badges: AchievementState[];
  rank: { now: number; of: number; up: number } | null;
}

/**
 * `seenLevel`/`seenAch` are null on a fresh install: they are seeded from the
 * state just before this settlement, so history never re-fires but a first win
 * can still unlock its badge.
 */
function readExtras(m: QueuedMoment): Extras {
  const w = useWallet.getState();
  const r = useRewards.getState();
  const now = levelFromXp(w.xp);
  const before = levelFromXp(Math.max(0, w.xp - m.xp));
  const seenLevel = r.seenLevel ?? before.level;
  const list = achievements(w.entries, w.xp);
  const seenAch =
    r.seenAch ??
    achievements(
      w.entries.map((e) => (e.id === m.entryId ? { ...e, state: 'PENDING' as const, payout: 0 } : e)),
      Math.max(0, w.xp - m.xp),
    )
      .filter((a) => a.unlocked)
      .map((a) => a.def.id);
  const next = useCelebrate.getState().queue[1];
  let rank: Extras['rank'] = null;
  if (m.rankBefore !== null) {
    // In a burst the following moment's "before" is exactly this one's "after".
    const standing = currentSeasonStanding();
    const after = next && next.rankBefore !== null ? next.rankBefore : standing.rank;
    rank = { now: after, of: standing.of, up: Math.max(0, m.rankBefore - after) };
  }
  return {
    levelUp: now.level > seenLevel ? { from: seenLevel, to: now.level } : null,
    level: now.level,
    xpFrom: before.level === now.level ? before.into / before.need : 0,
    xpTo: now.into / now.need,
    xpLeft: now.need - now.into,
    badges: list.filter((a) => a.unlocked && !seenAch.includes(a.def.id)),
    rank,
  };
}

export function useExtras(m: QueuedMoment): Extras {
  const [x] = useState(() => readExtras(m));
  useEffect(() => {
    useRewards.getState().markSeen({
      level: x.level,
      ach: achievements(useWallet.getState().entries, useWallet.getState().xp)
        .filter((a) => a.unlocked)
        .map((a) => a.def.id),
    });
  }, [x]);
  return x;
}

export const places = (n: number) => plural(n, { ru: [t('cel.place.one'), t('cel.place.few'), t('cel.place.many')], en: [t('cel.place.one'), t('cel.place.many')] });

/** Spoken summary of a win. Level-ups get their own moment, so they are not repeated here. */
export function describeWin(m: QueuedMoment, x: Extras): string {
  const parts = [t('cel.win.sr', { n: fmtNumber(m.payout) }), m.title];
  if (x.badges.length) parts.push(`${t('cel.badge')}: ${x.badges.map((a) => t(`scr.ach.${a.def.id}`)).join(', ')}`);
  return parts.join('. ');
}
