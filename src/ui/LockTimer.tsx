import { useEffect, useRef } from 'react';
import type { PoolStatus } from '@/domain/types';
import { fmtCountdown, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { IconLock } from './icons';
import { poolStatusView } from './primitives';

const WARN_MS = 30_000;
const URGENT_MS = 10_000;

export type LockTone = 'calm' | 'warn' | 'urgent' | 'closed';

export function lockTone(ms: number, accept: boolean): LockTone {
  if (!accept) return 'closed';
  if (ms <= URGENT_MS) return 'urgent';
  if (ms <= WARN_MS) return 'warn';
  return 'calm';
}

interface LockTimerProps {
  ms: number;
  totalMs: number;
  accept: boolean;
  status: PoolStatus;
  suspended?: boolean;
  variant?: 'pill' | 'ring';
  /** Ring diameter. */
  size?: number;
  /** Only the screen-level timer should tick haptics (last 5 s) and warn on close. */
  haptics?: boolean;
  className?: string;
}

/**
 * One lock timer for every pool surface (replaces LockBox and CountdownRing).
 * > 30 s neutral · ≤ 30 s orange · ≤ 10 s red with a per-second tick and "Closing" copy (not colour alone) · closed = lock.
 */
export function LockTimer({ ms, totalMs, accept, status, suspended = false, variant = 'pill', size = 40, haptics = false, className }: LockTimerProps) {
  const tone = lockTone(ms, accept);
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const frac = tone === 'closed' ? 0 : Math.max(0, Math.min(1, totalMs > 0 ? ms / totalMs : 0));

  const prevTone = useRef(tone);
  useEffect(() => {
    if (!haptics) return;
    if (tone === 'closed' && prevTone.current !== 'closed') haptic.notify('warning');
    else if (tone === 'urgent' && secs > 0 && secs <= 5) haptic.impact('light');
    prevTone.current = tone;
  }, [haptics, tone, secs]);

  const closedLabel = poolStatusView(status, false, suspended).label;
  const aria = tone === 'closed' ? closedLabel : `${t('pool.locksIn')} ${fmtCountdown(ms)}`;
  const cls = `lock-timer lock-timer--${variant} lock-timer--${tone}${className ? ` ${className}` : ''}`;

  if (variant === 'ring') {
    const r = (size - 5) / 2;
    const c = 2 * Math.PI * r;
    const label = secs >= 600 ? fmtCountdown(ms).replace(/:\d\d$/, '′') : secs >= 100 ? fmtCountdown(ms) : String(secs);
    return (
      <span className={cls} style={{ width: size, height: size }} role="timer" aria-label={aria}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle className="lock-timer__track" cx={size / 2} cy={size / 2} r={r} />
          <circle className="lock-timer__arc" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        {tone === 'closed' ? (
          <IconLock size={Math.round(size * 0.36)} className="lock-timer__lock" />
        ) : (
          <span key={tone === 'urgent' ? secs : undefined} className="lock-timer__v num" style={{ fontSize: size < 40 ? 11 : 13 }}>
            {label}
          </span>
        )}
      </span>
    );
  }

  if (tone === 'closed') {
    return (
      <span className={cls} role="status">
        <IconLock size={15} />
        <span className="lock-timer__label">{closedLabel}</span>
      </span>
    );
  }
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <span className={cls} role="timer" aria-label={aria}>
      <svg className="lock-timer__mini" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle className="lock-timer__track" cx="14" cy="14" r={r} />
        <circle className="lock-timer__arc" cx="14" cy="14" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 14 14)" />
      </svg>
      <span className="lock-timer__text">
        <small>{tone === 'urgent' ? t('pool2.closing') : t('pool.locksIn')}</small>
        <b key={tone === 'urgent' ? secs : undefined} className="lock-timer__v num">
          {fmtCountdown(ms)}
        </b>
      </span>
    </span>
  );
}
