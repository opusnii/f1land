import { useWallet } from '@/store/wallet';
import { useNav } from '@/store/nav';
import { t, fmtNumber } from '@/i18n/core';
import { telegramUser, haptic } from '@/telegram/sdk';
import { IconPlus, LogoPulse } from '@/ui/icons';
import { Obj } from '@/ui/Obj';
import { DriverAvatar } from '@/ui/kit';
import { useSettings } from '@/store/settings';

export function Header({ right }: { right?: React.ReactNode }) {
  const balance = useWallet((s) => s.balance);
  const push = useNav((s) => s.push);
  const go = useNav((s) => s.go);
  const fav = useSettings((s) => s.favoriteDriver);
  const user = telegramUser();
  return (
    <header className="topbar">
      <div className="brand logo-lockup" aria-label="Pulse Arena">
        <LogoPulse className="logo-lockup__mark" />
        <span className="logo-lockup__word" aria-hidden="true">
          PULSE <b>ARENA</b>
        </span>
      </div>
      <div className="topbar__spacer" />
      {right}
      <button
        className="balance-chip"
        aria-label={`${t('shell.demoBalance')}: ${fmtNumber(balance)}`}
        onClick={() => {
          haptic.tap();
          push({ name: 'wallet' });
        }}
      >
        <Obj name="coin" size={22} className="balance-chip__coin" priority />
        <span className="balance-chip__val num" key={balance}>
          {fmtNumber(balance)}
        </span>
        <span className="balance-chip__plus" aria-hidden="true">
          <IconPlus size={13} />
        </span>
      </button>
      <button
        className="avatar-btn"
        aria-label={t('nav.profile')}
        onClick={() => {
          haptic.tap();
          go('profile');
        }}
      >
        {user?.photo ? <img src={user.photo} alt="" /> : <DriverAvatar id={fav ?? 'nor'} size={36} />}
        <span className="avatar-btn__dot" />
      </button>
    </header>
  );
}

export function SubHeader({ title, onBack, right }: { title?: React.ReactNode; onBack: () => void; right?: React.ReactNode }) {
  return (
    <header className="topbar topbar--sub">
      <button
        className="icon-btn"
        aria-label={t('ui.back')}
        onClick={() => {
          haptic.tap();
          onBack();
        }}
      >
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </button>
      {title && <div className="topbar__title">{title}</div>}
      {!title && <div className="topbar__spacer" />}
      {right}
    </header>
  );
}
