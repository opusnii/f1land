import { useEffect, useRef, useState } from 'react';
import { STREAK_BONUS, useRewards, useStreak } from '@/store/rewards';
import { useNav } from '@/store/nav';
import { fmtNumber, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { useReduced } from '@/screens/common';
import { streakTrack } from '@/ui/celebrate/streak';
import { Obj } from '@/ui/Obj';
import { IconChevron, IconGift } from '@/ui/icons';

/** Coins fly from the claim chip to the header balance (spec §6 "Balance in the header"). */
function flyCoins(from: Element, n = 6) {
  const to = document.querySelector('.balance-chip__coin') ?? document.querySelector('.balance-chip');
  if (!to) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.className = 'hm-coinfly';
    el.style.left = `${a.left + a.width / 2 - 7}px`;
    el.style.top = `${a.top + a.height / 2 - 7}px`;
    document.body.appendChild(el);
    const lift = -30 - (i % 3) * 12;
    const spread = (i - (n - 1) / 2) * 10;
    const anim = el.animate(
      [
        { transform: 'translate(0,0) scale(.4)', opacity: 0 },
        { transform: `translate(${spread}px, ${lift}px) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0.9 },
      ],
      { duration: 720, delay: i * 50, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'backwards' },
    );
    anim.onfinish = anim.oncancel = () => el.remove();
  }
}

/** Day-to-midnight refresh so "checked today" flips at local midnight without a reload. */
function useToday(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const d = new Date(now);
    d.setHours(24, 0, 0, 0);
    const id = window.setTimeout(() => setNow(Date.now()), d.getTime() - now + 60);
    return () => window.clearTimeout(id);
  }, [now]);
  return now;
}

/** Streak (spec §9.1 item 5): flame object and seven pit lights instead of a sentence. */
export function HomeStreak() {
  const now = useToday();
  const view = useStreak(now);
  const reduced = useReduced();
  const chip = useRef<HTMLButtonElement>(null);
  const [added, setAdded] = useState(0);
  const { days } = streakTrack(view);
  const cold = view.count === 0 && !view.checkedToday;
  const headline = view.count > 0 ? t('streak.day', { n: view.count }) : t('streak.start');

  const claim = () => {
    const from = chip.current;
    const r = useRewards.getState().checkIn();
    if (!r.ok) return;
    haptic.notify('success');
    sfx.checkIn();
    setAdded(r.bonus);
    if (from && !reduced) flyCoins(from);
  };

  return (
    <div className="card hm-streak" data-cold={cold || undefined}>
      <button
        type="button"
        className="hm-streak__main"
        onClick={() => {
          haptic.tap();
          useNav.getState().push({ name: 'rewards' });
        }}
      >
        <Obj name="flame" size={44} className="hm-streak__flame" />
        <span className="hm-streak__txt">
          <b>{headline}</b>
          <ol className="hm-lights" aria-label={t('hl.streak.lights')}>
            {STREAK_BONUS.map((bonus, i) => (
              <li key={i} data-state={days[i]} aria-label={t('streak.pill', { n: i + 1, b: bonus, s: t(`streak.pill.${days[i]}`) })} />
            ))}
          </ol>
        </span>
        {view.checkedToday && <IconChevron size={16} className="hm-streak__chev" />}
      </button>
      {!view.checkedToday && (
        <button ref={chip} type="button" className="hm-streak__claim num" onClick={claim} aria-label={t('streak.claim', { n: view.nextBonus })}>
          <IconGift size={16} />+{view.nextBonus}
        </button>
      )}
      <span className="sr-only" role="status">
        {added ? t('streak.added', { n: fmtNumber(added) }) : ''}
      </span>
    </div>
  );
}
