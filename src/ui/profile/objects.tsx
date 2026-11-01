/* Studio objects and mechanic icons used across profile, rewards, wallet and tickets. */
import type { ReactNode } from 'react';
import { hasAsset } from '@/assets';
import { layoutOf, type PoolLayout } from '@/app/poolText';
import type { Pool } from '@/domain/types';
import type { AchievementState } from '@/demo/progress';
import { Obj } from '@/ui/Obj';
import { IcLink, IcPodium, IcStopwatch, IcSwords } from '@/ui/bet/icons';
import { IconFlag, IconPit, IconTarget, IconTimer, IconTyre } from '@/ui/icons';
import { t } from '@/i18n/core';
import { AchGlyph } from '@/screens/common';

/** Weekend mission → object (group E). */
export const MISSION_OBJ: Record<string, string> = {
  predict3: 'steering-wheel',
  pitCall: 'pit-gun',
  duelWin: 'flag-chequered',
  variety: 'tyre-medium',
  win2: 'trophy-gold',
  daily: 'gift',
};

export const PODIUM_TROPHY = ['trophy-gold', 'trophy-silver', 'trophy-bronze'] as const;

const LAYOUT_ICON: Record<PoolLayout, (size: number) => ReactNode> = {
  zone: (s) => <IconTarget size={s} />,
  duel: (s) => <IcSwords size={s} />,
  pit: (s) => <IconPit size={s} />,
  tyre: (s) => <IconTyre size={s} />,
  pace: (s) => <IcStopwatch size={s} />,
  incident: (s) => <IconFlag size={s} />,
  position: (s) => <IcPodium size={s} />,
  quali: (s) => <IconTimer size={s} />,
  combo: (s) => <IcLink size={s} />,
};

/** Line icon of the pool mechanic (same set as the pool screen header). */
export function MechIcon({ pool, size = 20 }: { pool: Pick<Pool, 'market_id'>; size?: number }) {
  return <>{LAYOUT_ICON[layoutOf(pool)](size)}</>;
}

/** Enamel achievement badge (group H). Locked badges are desaturated; unmapped ids fall back to the line glyph. */
export function AchBadge({ a, size = 56, label }: { a: AchievementState; size?: number; label?: boolean }) {
  const alt = label ? t('pv2.pf.ach', { name: t(`scr.ach.${a.def.id}`) }) : '';
  if (hasAsset(a.def.id)) return <Obj name={a.def.id} size={size} alt={alt} className={`ach-badge${a.unlocked ? '' : ' ach-badge--locked'}`} />;
  return (
    <span className={`ach-badge ach-badge--glyph sc-ic sc-ic--${a.def.tone}${a.unlocked ? '' : ' ach-badge--locked'}`} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label ? alt : undefined}>
      <AchGlyph icon={a.def.icon} size={Math.round(size * 0.45)} />
    </span>
  );
}

/** Type scale steps (spec §4); the badge number snaps to the largest that fits its disc. */
const SCALE = [13, 15, 17, 20, 24, 32, 44];
const numSize = (size: number) => SCALE.filter((s) => s <= size * 0.37).pop() ?? 13;

/** Hex level badge with the level number in its centre. */
export function LevelBadge({ level, size = 48 }: { level: number; size?: number }) {
  return (
    <span className="lvl-badge" style={{ width: size, height: size, fontSize: numSize(size) }} role="img" aria-label={t('pv2.lvlBadge', { n: level })}>
      <Obj name="level" size={size} />
      <b className="lvl-badge__n num" aria-hidden="true">
        {level}
      </b>
    </span>
  );
}
