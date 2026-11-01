import { useMemo, useState } from 'react';
import { useWallet, type Entry, type EntryState } from '@/store/wallet';
import { useNav } from '@/store/nav';
import { CIRCUIT_META } from '@/data/circuits';
import { playerStats } from '@/demo/progress';
import { SubHeader } from '@/app/Header';
import { poolTexts } from '@/app/poolText';
import { Chip } from '@/ui/kit';
import { Flag } from '@/ui/Obj';
import { EmptyState } from '@/ui/primitives';
import { MechIcon } from '@/ui/profile/objects';
import { IconChevron, IconPlay } from '@/ui/icons';
import { fmtClock, fmtNumber, getLang, t } from '@/i18n/core';
import { EntryBadge, PageHead, Reveal, groupByDay, signed, useBack } from './common';
import '@/styles/screens/history.css';

type F = 'all' | EntryState;

const FILTERS: Array<{ id: F; key: string }> = [
  { id: 'all', key: 'ui.all' },
  { id: 'PENDING', key: 'entries.pending' },
  { id: 'WON', key: 'entries.won' },
  { id: 'LOST', key: 'entries.lost' },
  { id: 'VOID', key: 'entries.void' },
];

export function HistoryScreen() {
  const back = useBack();
  const entries = useWallet((s) => s.entries);
  const go = useNav((s) => s.go);
  const push = useNav((s) => s.push);
  const [f, setF] = useState<F>('all');
  const lang = getLang();
  const stats = useMemo(() => playerStats(entries), [entries]);
  const counts = useMemo(() => {
    const c: Record<F, number> = { all: entries.length, PENDING: 0, WON: 0, LOST: 0, VOID: 0 };
    for (const e of entries) c[e.state]++;
    return c;
  }, [entries]);
  const groups = useMemo(() => {
    const list = entries.filter((e) => f === 'all' || e.state === f).sort((a, b) => b.createdAt - a.createdAt);
    return groupByDay(list, (e) => e.createdAt);
  }, [entries, f, lang]);
  let n = 0;
  return (
    <>
      <SubHeader onBack={back} />
      <PageHead title={t('profile.history')} sub={t('scr.history.sub')} />
      <div className="card hs-sum">
        <div>
          <b className="num">{stats.total}</b>
          <span>{t('profile.entries')}</span>
        </div>
        <div>
          <b className="num lime">{stats.won}</b>
          <span>{t('entries.won')}</span>
        </div>
        <div>
          <b className="num red">{stats.lost}</b>
          <span>{t('entries.lost')}</span>
        </div>
        <div>
          <b className={`num ${stats.profit > 0 ? 'lime' : stats.profit < 0 ? 'red' : ''}`}>{signed(stats.profit, (x) => fmtNumber(x))}</b>
          <span>{t('profile.profit')}</span>
        </div>
      </div>
      <div className="hs-chips" role="group" aria-label={t('scr.history.filter')}>
        {FILTERS.map((x) => (
          <Chip key={x.id} on={f === x.id} onClick={() => setF(x.id)}>
            {t(x.key)}
            <span className="hs-chips__n num">{counts[x.id]}</span>
          </Chip>
        ))}
      </div>
      {groups.length === 0 ? (
        <div className="card">
          <EmptyState
            art={entries.length ? undefined : 'empty-history'}
            title={entries.length ? t('scr.history.emptyFilter') : t('entries.empty')}
            body={entries.length ? undefined : t('pv2.hist.emptyBody')}
            compact={!!entries.length}
            action={
              !entries.length && (
                <button className="btn btn--primary" onClick={() => go('live')}>
                  <IconPlay size={16} />
                  {t('pv2.toLive')}
                </button>
              )
            }
          />
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="hs-group">
            <div className="sc-daylabel">
              {g.label}
              <span className="num">{g.items.length}</span>
            </div>
            <div className="hs-list">
              {g.items.map((e) => (
                <Reveal key={e.id} i={n++}>
                  <HistoryRow e={e} onOpen={() => push({ name: 'entry', entryId: e.id })} />
                </Reveal>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

function HistoryRow({ e, onOpen }: { e: Entry; onOpen: () => void }) {
  const lang = getLang();
  const meta = CIRCUIT_META.find((c) => c.id === e.circuitId);
  let tx: { title: string; question: string };
  try {
    tx = poolTexts(e.pool);
  } catch {
    tx = { title: '', question: t(e.questionKey, e.questionParams) };
  }
  const pending = e.state === 'PENDING';
  return (
    <button className="card hs-row" data-state={e.state} onClick={onOpen}>
      <span className="hs-row__top">
        <span className="hs-row__mech" aria-hidden="true">
          <MechIcon pool={e.pool} size={16} />
        </span>
        <span className="hs-row__fam ellipsis">{tx.title || e.meetingName[lang] || meta?.name}</span>
        <EntryBadge e={e} />
      </span>
      <span className="hs-row__q">{tx.question}</span>
      <span className="hs-row__meet">
        <Flag cc={meta?.countryCode} size={16} />
        <span className="ellipsis">{e.meetingName[lang] || meta?.name}</span>
        <span className="num">· {fmtClock(e.createdAt)}</span>
      </span>
      <span className="hs-row__foot">
        <span className="hs-row__pick">
          <i>{t('entries.yourPick')}</i>
          <b>{e.outcomeLabel}</b>
        </span>
        <span className="hs-row__num">
          <i>{t('entries.stake')}</i>
          <b className="num">{fmtNumber(e.stake)}</b>
        </span>
        <span className="hs-row__num">
          <i>{pending ? t('entries.potential') : t('entries.payout')}</i>
          <b className={`num ${e.state === 'WON' ? 'lime' : e.state === 'LOST' ? 'sc-neg' : ''}`}>{pending ? `≈${fmtNumber(Math.round(e.stake * e.estimate))}` : fmtNumber(e.payout)}</b>
        </span>
        <IconChevron size={14} className="icon muted" />
      </span>
    </button>
  );
}
