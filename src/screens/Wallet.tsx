import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useWallet, type Tx } from '@/store/wallet';
import { useNav } from '@/store/nav';
import { useToasts } from '@/store/toasts';
import { playerStats } from '@/demo/progress';
import { SubHeader } from '@/app/Header';
import { useNow } from '@/ui/kit';
import { Obj } from '@/ui/Obj';
import { EmptyState } from '@/ui/primitives';
import { CountUp } from '@/ui/bet/motionBits';
import { CoinLayer, flyCoins, useCoinFx, useHeldBalance } from '@/ui/celebrate/coins';
import { IconBolt, IconCheck, IconChevron, IconGift, IconInfo, IconTarget, IconTimer, IconTrophy } from '@/ui/icons';
import { fmtClock, fmtCountdown, fmtNumber, getLang, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { PageHead, Reveal, groupByDay, signed, useBack, useReduced } from './common';
import '@/styles/screens/wallet.css';

const DAILY_MS = 20 * 3600_000;
const DAILY_AMOUNT = 200;
const TOPUPS = [500, 1000, 2500, 5000];

/** Counts up/down to `value` on change; instant when motion is reduced. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reduced = useReduced();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    const dur = 650;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, reduced]);
  return <span className={className}>{fmtNumber(shown)}</span>;
}

function TxIcon({ kind }: { kind: Tx['kind'] }) {
  switch (kind) {
    case 'stake':
      return <IconTarget size={18} />;
    case 'payout':
      return <IconTrophy size={18} />;
    case 'refund':
      return <IconCheck size={18} />;
    case 'bonus':
      return <IconGift size={18} />;
    case 'topup':
      return <IconBolt size={18} />;
  }
}

export function WalletScreen() {
  const back = useBack();
  const txs = useWallet((s) => s.txs);
  const entries = useWallet((s) => s.entries);
  const lastDaily = useWallet((s) => s.lastDaily);
  const push = useNav((s) => s.push);
  const toast = useToasts((s) => s.push);
  const reduced = useReduced();
  const shown = useHeldBalance();
  const bump = useCoinFx((s) => s.bump);
  const now = useNow(1000);
  const [limit, setLimit] = useState(40);
  const [announce, setAnnounce] = useState('');
  const balRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(() => playerStats(entries), [entries]);
  const next = lastDaily + DAILY_MS;
  const ready = now >= next;
  const lang = getLang();
  const groups = useMemo(() => groupByDay(txs.slice(0, limit), (x) => x.at), [txs, limit, lang]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  /** Coins fly from the pressed control to the balance; without motion a toast confirms instead. */
  const credited = (from: Element | null, n: number, title: string) => {
    const flying = flyCoins(from, { to: balRef.current, reduced });
    setAnnounce(t('streak.added', { n: fmtNumber(n) }));
    if (!flying) toast({ kind: 'win', title });
  };

  const claim = (e: MouseEvent<HTMLButtonElement>) => {
    const from = e.currentTarget;
    if (Date.now() - useWallet.getState().lastDaily < DAILY_MS) {
      haptic.notify('error');
      sfx.lose();
      return;
    }
    credited(from, DAILY_AMOUNT, t('scr.wallet.bonusToast', { n: DAILY_AMOUNT }));
    useWallet.getState().claimDaily();
    haptic.notify('success');
    sfx.checkIn();
  };

  const topup = (e: MouseEvent<HTMLButtonElement>, n: number) => {
    credited(e.currentTarget, n, t('scr.wallet.topupToast', { n: fmtNumber(n) }));
    useWallet.getState().credit('topup', n);
    haptic.notify('success');
    sfx.confirm();
  };

  return (
    <>
      <SubHeader onBack={back} />
      <PageHead title={t('wallet.title')} sub={t('wallet.sub')} />
      <Reveal i={0}>
        <section className="card wl-hero" aria-label={t('pv2.wallet.balance')}>
          <Obj name="coin-stack" size={112} className="wl-hero__art" priority />
          <div className="wl-hero__k">
            {t('pv2.wallet.balance')}
            <span className="sc-pill sc-pill--demo">DEMO</span>
          </div>
          <div ref={balRef} className="wl-hero__v" data-bump={bump || undefined}>
            <CountUp value={shown} duration={700} className="num" />
            <span className="wl-hero__u">PULSE</span>
            {bump > 0 && <i key={bump} className="wl-hero__fx" aria-hidden="true" />}
          </div>
          <p className="wl-hero__note">
            <IconInfo size={14} />
            <span>{t('wallet.note')}</span>
          </p>
          <div className="wl-hero__stats">
            <div>
              <span className="num">{fmtNumber(stats.staked)}</span>
              <i>{t('scr.wallet.staked')}</i>
            </div>
            <div>
              <span className="num">{fmtNumber(stats.returned)}</span>
              <i>{t('scr.wallet.returned')}</i>
            </div>
            <div>
              <span className={`num ${stats.profit > 0 ? 'lime' : stats.profit < 0 ? 'red' : ''}`}>{signed(stats.profit, (n) => fmtNumber(n))}</span>
              <i>{t('profile.profit')}</i>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal i={1} className="section">
        <div className={`card wl-daily${ready ? ' wl-daily--ready' : ''}`}>
          <Obj name="gift" size={52} className="wl-daily__art" />
          <div className="wl-daily__txt">
            <b>{t('wallet.daily')}</b>
            <span>{ready ? t('scr.wallet.dailyReady', { n: DAILY_AMOUNT }) : t('scr.wallet.dailyNext')}</span>
          </div>
          {ready ? (
            <button className="btn btn--primary btn--sm wl-daily__btn" onClick={claim}>
              {t('wallet.claim')}
              <b className="num">+{DAILY_AMOUNT}</b>
            </button>
          ) : (
            <span className="wl-daily__cd num" role="timer">
              <IconTimer size={14} />
              {fmtCountdown(next - now)}
            </span>
          )}
        </div>
      </Reveal>

      <Reveal i={2} className="section">
        <div className="section__head">
          <h2 className="section__title">{t('wallet.topup')}</h2>
          <span className="sc-note">{t('scr.wallet.topupNote')}</span>
        </div>
        <div className="wl-chips">
          {TOPUPS.map((n) => (
            <button key={n} className="tile wl-chip" onClick={(e) => topup(e, n)} aria-label={t('pv2.wallet.chip', { n: fmtNumber(n) })}>
              <Obj name={n >= 2500 ? 'coin-stack' : 'coin'} size={36} className="wl-chip__coin" />
              <b className="num">+{fmtNumber(n)}</b>
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal i={3} className="section">
        <div className="section__head">
          <h2 className="section__title">{t('wallet.tx')}</h2>
          <span className="sc-note num">{txs.length}</span>
        </div>
        {txs.length === 0 ? (
          <div className="card">
            <EmptyState art="empty-history" title={t('scr.wallet.noTx')} compact />
          </div>
        ) : (
          <div className="wl-txgroups">
            {groups.map((g) => (
              <div key={g.key} className="wl-txgroup">
                <div className="sc-daylabel">{g.label}</div>
                <div className="card wl-txlist">
                  {g.items.map((tx) => {
                    const e = tx.entryId ? byId.get(tx.entryId) : undefined;
                    const Row = e ? 'button' : 'div';
                    return (
                      <Row key={tx.id} className="wl-tx" data-kind={tx.kind} {...(e ? { onClick: () => push({ name: 'entry', entryId: e.id }) } : {})}>
                        <span className="wl-tx__ic">
                          <TxIcon kind={tx.kind} />
                        </span>
                        <span className="wl-tx__txt">
                          <b>{t(`wallet.tx.${tx.kind}`)}</b>
                          <span>{e ? `${e.outcomeLabel} · ${e.meetingName[lang]}` : tx.id === 'tx_welcome' ? t('scr.wallet.welcome') : fmtClock(tx.at)}</span>
                        </span>
                        <span className={`wl-tx__amt num ${tx.amount > 0 ? 'lime' : tx.amount < 0 ? 'sc-neg' : ''}`}>{signed(tx.amount, (n) => fmtNumber(n))}</span>
                        {e && <IconChevron size={14} className="icon muted" />}
                      </Row>
                    );
                  })}
                </div>
              </div>
            ))}
            {txs.length > limit && (
              <button className="btn btn--ghost btn--block" onClick={() => setLimit(limit + 40)}>
                {t('scr.showMore')}
              </button>
            )}
          </div>
        )}
      </Reveal>
      <span className="sr-only" role="status">
        {announce}
      </span>
      <CoinLayer />
    </>
  );
}
