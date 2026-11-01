import type { CalendarSession, Meeting } from '@/data/calendar';
import { CHANNELS, type DemoChannel } from '@/demo/channels';
import { useLive } from '@/store/live';
import { useNav } from '@/store/nav';
import { fmtCountdown, fmtDuration, getLang } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';

export function channelFor(m: Meeting, s?: CalendarSession): DemoChannel | undefined {
  return CHANNELS.find((c) => c.meetingRound === m.round && (!s || c.sessionType === s.sessionType));
}

export function watchChannel(ch: DemoChannel): void {
  haptic.impact('medium');
  sfx.nav();
  void useLive.getState().open(ch.id);
  useNav.getState().go('live');
}

export type SessState = 'done' | 'live' | 'upcoming';

export function sessState(s: CalendarSession, now: number): SessState {
  if (now >= Date.parse(s.endsAt)) return 'done';
  if (now >= Date.parse(s.startsAt)) return 'live';
  return 'upcoming';
}

/** Live session of the meeting, else the next one not yet started. */
export function focusSession(m: Meeting, now: number): { s: CalendarSession; live: boolean } | null {
  const live = m.sessions.find((s) => sessState(s, now) === 'live');
  if (live) return { s: live, live: true };
  const next = m.sessions.find((s) => sessState(s, now) === 'upcoming');
  return next ? { s: next, live: false } : null;
}

/** "17 ч 16 мин" style countdown, ticking seconds only in the last hour. */
export function startsIn(ms: number): string {
  if (ms < 3_600_000) return fmtCountdown(ms);
  return fmtDuration(ms);
}

// Calendars headline a race by its country; these read better than the CLDR names.
const COUNTRY: Record<string, { ru: string; en: string }> = {
  US: { ru: 'США', en: 'USA' },
  AE: { ru: 'Абу-Даби', en: 'Abu Dhabi' },
  GB: { ru: 'Великобритания', en: 'Great Britain' },
};
const regionNames = new Map<string, Intl.DisplayNames | null>();

export function countryName(cc: string): string {
  const lang = getLang();
  const own = COUNTRY[cc]?.[lang];
  if (own) return own;
  if (!regionNames.has(lang)) {
    try {
      regionNames.set(lang, new Intl.DisplayNames([lang], { type: 'region' }));
    } catch {
      regionNames.set(lang, null);
    }
  }
  return regionNames.get(lang)?.of(cc) ?? cc;
}
