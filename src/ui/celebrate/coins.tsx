/* Coin flight (spec §6 "Баланс в шапке"): coins fly from the source to a balance readout, which counts up as they land. */
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { create } from 'zustand';
import { assetUrl } from '@/assets';
import { useWallet } from '@/store/wallet';
import { haptic } from '@/telegram/sdk';

interface Pt {
  x: number;
  y: number;
}

interface Flight {
  key: number;
  from: Pt;
  to: Pt;
  count: number;
}

interface CoinFxState {
  flight: Flight | null;
  /** True while coins are in the air: balance readouts keep the old number until they land. */
  held: boolean;
  /** Increments on landing; readouts use it to pulse once. */
  bump: number;
}

export const useCoinFx = create<CoinFxState>(() => ({ flight: null, held: false, bump: 0 }));

const LAND_MS = 640;
const CLEAR_MS = 1700;
let timers: number[] = [];

function centre(el: Element): Pt {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** The balance chip in the visible top bar, if the current screen has one. */
export function headerBalanceEl(): Element | null {
  return document.querySelector('.topbar .balance-chip');
}

/**
 * Call right BEFORE crediting the wallet (the source may unmount once the store updates).
 * Returns false when nothing will fly (reduced motion, no source or target); readouts then update at once.
 */
export function flyCoins(from: Element | null | undefined, opts: { to?: Element | null; count?: number; reduced: boolean }): boolean {
  const to = opts.to === undefined ? headerBalanceEl() : opts.to;
  if (opts.reduced || !from || !to) return false;
  timers.forEach((id) => window.clearTimeout(id));
  useCoinFx.setState({ flight: { key: Date.now(), from: centre(from), to: centre(to), count: opts.count ?? 9 }, held: true });
  timers = [
    window.setTimeout(() => {
      useCoinFx.setState((s) => ({ held: false, bump: s.bump + 1 }));
      haptic.impact('light');
    }, LAND_MS),
    window.setTimeout(() => useCoinFx.setState({ flight: null }), CLEAR_MS),
  ];
  return true;
}

/** Wallet balance as a readout should show it: frozen while coins are in flight, then released to count up. */
export function useHeldBalance(): number {
  const balance = useWallet((s) => s.balance);
  const held = useCoinFx((s) => s.held);
  const [shown, setShown] = useState(balance);
  useEffect(() => {
    if (!held) setShown(balance);
  }, [balance, held]);
  return shown;
}

function Coins({ flight }: { flight: Flight }) {
  const { from, to, count } = flight;
  const bg = { backgroundImage: `url(${assetUrl('coin', 48)})` } as CSSProperties;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const spread = (i - (count - 1) / 2) * 0.36;
        const dist = 46 + ((i * 37) % 5) * 9;
        const sx = Math.sin(spread) * dist;
        const sy = -Math.cos(spread) * dist;
        const tm = { duration: 0.95, times: [0, 0.4, 1] };
        return (
          <motion.i
            key={i}
            className="coinfx__coin"
            style={{ left: from.x, top: from.y, ...bg }}
            initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
            animate={{ x: [0, sx, to.x - from.x], y: [0, sy, to.y - from.y], scale: [0.3, 1, 0.55], opacity: [0, 1, 1, 0] }}
            transition={{
              delay: i * 0.045,
              x: { ...tm, ease: ['easeOut', 'easeIn'] },
              y: { ...tm, ease: ['easeOut', 'easeIn'] },
              scale: tm,
              opacity: { duration: 0.95, times: [0, 0.12, 0.85, 1] },
            }}
          />
        );
      })}
    </>
  );
}

/** Viewport-level coin layer. Mount exactly one per screen that starts flights. */
export function CoinLayer() {
  const flight = useCoinFx((s) => s.flight);
  if (!flight || typeof document === 'undefined') return null;
  return createPortal(
    <div className="coinfx" aria-hidden="true">
      <Coins key={flight.key} flight={flight} />
    </div>,
    document.body,
  );
}
