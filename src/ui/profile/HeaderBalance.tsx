import { useNav } from '@/store/nav';
import { useWallet } from '@/store/wallet';
import { fmtNumber, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { Obj } from '@/ui/Obj';
import { IconPlus } from '@/ui/icons';
import { CountUp } from '@/ui/bet/motionBits';
import { useCoinFx, useHeldBalance } from '@/ui/celebrate/coins';

/** Header balance chip for sub-screens (same `.balance-chip` as the main header); the target of coin flights. */
export function HeaderBalance() {
  const balance = useWallet((s) => s.balance);
  const shown = useHeldBalance();
  const bump = useCoinFx((s) => s.bump);
  const push = useNav((s) => s.push);
  return (
    <button
      className="balance-chip pv-balchip"
      aria-label={`${t('shell.demoBalance')}: ${fmtNumber(balance)}`}
      onClick={() => {
        haptic.tap();
        push({ name: 'wallet' });
      }}
    >
      <Obj name="coin" size={22} className="balance-chip__coin" priority />
      <CountUp className="balance-chip__val num" value={shown} duration={700} />
      <span className="balance-chip__plus" aria-hidden="true">
        <IconPlus size={13} />
      </span>
      {bump > 0 && <i key={bump} className="pv-balchip__fx" aria-hidden="true" />}
    </button>
  );
}
