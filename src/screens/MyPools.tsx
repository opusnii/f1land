import { useMemo, useState, type ReactNode } from 'react';
import { useWallet, type Entry, type Tx } from '@/store/wallet';
import { useNav } from '@/store/nav';
import { useLive } from '@/store/live';
import { CIRCUIT_META } from '@/data/circuits';
import { fmtClock, fmtDate, fmtLap, fmtNumber, getLang, t } from '@/i18n/core';
import { Header, SubHeader } from '@/app/Header';
import { poolTexts } from '@/app/poolText';
import { settleFromReplay } from '@/app/sessionService';
import { Card, Collapsible, Segmented } from '@/ui/kit';
import { IconChevron, IconGift, IconRefund, IconTicket, IconTrophy, IconPlus } from '@/ui/icons';
import { Flag, Obj } from '@/ui/Obj';
import { EmptyState } from '@/ui/primitives';
import { IcSwords } from '@/ui/bet/icons';
import { MechIcon } from '@/ui/profile/objects';
import { OfflineState, SkelList, useFeedPaused } from '@/ui/profile/States';
import type { Settlement } from '@/domain/types';
import { haptic } from '@/telegram/sdk';
import { DRIVER_BY_ID } from '@/data/teams';
import '@/styles/mypools.css';

type Tab = 'open' | 'settled' | 'history';

export function stateBadge(e: Entry) {
  const cls = e.state === 'WON' ? 'badge--lime' : e.state === 'LOST' ? 'badge--red' : e.state === 'VOID' ? 'badge--yellow' : e.settlement?.provisional ? 'badge--cyan' : 'badge--ghost';
  const key = e.state === 'WON' ? 'entries.won' : e.state === 'LOST' ? 'entries.lost' : e.state === 'VOID' ? 'entries.void' : e.settlement?.provisional ? 'entries.provisional' : 'entries.pending';
  return <span className={`badge ${cls}`}>{t(key)}</span>;
}

/** Ticket hero object per entry state (group E). */
const STATE_OBJ: Record<Entry['state'], string> = { WON: 'trophy-gold', LOST: 'flag-chequered', VOID: 'flag-yellow', PENDING: 'stopwatch' };

const potential = (e: Entry) => Math.round(e.stake * e.estimate);

export function MyPoolsScreen() {
  const entries = useWallet((s) => s.entries);
  const txs = useWallet((s) => s.txs);
  const push = useNav((s) => s.push);
  const go = useNav((s) => s.go);
  const activeSession = useLive((s) => s.runner?.manifest.session_id ?? null);
  const paused = useFeedPaused();
  const [tab, setTab] = useState<Tab>('open');
  const open = entries.filter((e) => e.state === 'PENDING');
  const settled = entries.filter((e) => e.state !== 'PENDING');
  const inPlay = open.reduce((a, e) => a + e.stake, 0);
  const wonTotal = settled.reduce((a, e) => a + (e.state === 'WON' ? e.payout : 0), 0);
  const decided = settled.filter((e) => e.state === 'WON' || e.state === 'LOST');
  const hitRate = decided.length ? Math.round((decided.filter((e) => e.state === 'WON').length / decided.length) * 100) : null;
  const openEntry = (e: Entry) => push({ name: 'entry', entryId: e.id });
  const toLive = () => {
    haptic.impact('light');
    go('live');
  };
  // Pending picks of the running session wait on the feed; say so instead of looking stuck.
  const waitingOnFeed = paused && open.some((e) => e.sessionId === activeSession);

  return (
    <div className="mypools">
      <Header />
      <h1 className="page-title">{t('entries.title')}</h1>
      <p className="page-sub">{t('entries.sub')}</p>

      <div className="card mp-stats">
        <div className="mp-stat">
          <span className="mp-stat__k">{t('mp.inPlay')}</span>
          <span className="mp-stat__v num">
            <Obj name="coin" size={18} /> {fmtNumber(inPlay)}
          </span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat__k">{t('mp.wonTotal')}</span>
          <span className={`mp-stat__v num${wonTotal > 0 ? ' lime' : ''}`}>+{fmtNumber(wonTotal)}</span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat__k">{t('mp.hitRate')}</span>
          <span className="mp-stat__v num">{hitRate === null ? '—' : `${hitRate}%`}</span>
        </div>
      </div>

      <Segmented<Tab>
        label={t('entries.title')}
        value={tab}
        onChange={setTab}
        options={[
          { id: 'open', label: t('entries.open'), count: open.length },
          { id: 'settled', label: t('entries.settled'), count: settled.length },
          { id: 'history', label: t('entries.history') },
        ]}
      />

      <div className="mp-panel" key={tab}>
        {tab === 'open' && (
          <>
            {waitingOnFeed && <OfflineState compact />}
            {open.length === 0 ? (
              <>
                <div className="card">
                  <EmptyState
                    art="empty-picks"
                    title={t('entries.empty')}
                    body={t('mp.emptyOpenSub')}
                    action={
                      <button className="btn btn--primary" onClick={toLive}>
                        {t('pv2.toLive')}
                      </button>
                    }
                  />
                </div>
                <ExamplePick />
              </>
            ) : (
              <>
                <div className="mp-head">{t('pv2.mp.openSub')}</div>
                <div className="mp-list">
                  {open.map((e) => (
                    <EntryCard key={e.id} e={e} onOpen={() => openEntry(e)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {tab === 'settled' && (
          <>
            {settled.length === 0 ? (
              <div className="card">
                <EmptyState
                  art="empty-results"
                  title={t('mp.emptySettled')}
                  body={t('mp.emptySettledSub')}
                  action={
                    open.length > 0 && (
                      <button className="btn btn--ghost" onClick={() => setTab('open')}>
                        {t('pv2.mp.settledEmptyCta')}
                      </button>
                    )
                  }
                />
              </div>
            ) : (
              <>
                <div className="mp-head">{t('entries.settledSub')}</div>
                <div className="mp-list">
                  {settled.map((e) => (
                    <EntryCard key={e.id} e={e} onOpen={() => openEntry(e)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {tab === 'history' &&
          (txs.length === 0 ? (
            <div className="card">
              <EmptyState art="empty-history" title={t('mp.emptyHistory')} compact />
            </div>
          ) : (
            <div className="card mp-history">
              {txs.map((x) => (
                <TxRow key={x.id} x={x} onOpen={x.entryId && entries.some((e) => e.id === x.entryId) ? () => push({ name: 'entry', entryId: x.entryId! }) : undefined} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

/** A static, labelled sample ticket so a first-time player sees what they are about to make. */
function ExamplePick() {
  return (
    <figure className="mp-example">
      <figcaption className="mp-example__cap">{t('pv2.mp.example')}</figcaption>
      <div className="card ticket ticket--pending ticket--example" aria-hidden="true">
        <div className="ticket__main">
          <span className="ticket__icon">
            <IcSwords size={20} />
          </span>
          <div className="ticket__info">
            <div className="ticket__kicker">{t('pv2.mp.ex.fam')}</div>
            <div className="ticket__q">{t('pv2.mp.ex.q')}</div>
          </div>
          <span className="badge badge--ghost">{t('pv2.mp.exampleTag')}</span>
        </div>
        <div className="ticket__perf" />
        <div className="ticket__stats">
          <div className="ticket__stat ticket__stat--pick">
            <span className="ticket__k">{t('entries.yourPick')}</span>
            <span className="ticket__v">{t('pv2.mp.ex.pick')}</span>
          </div>
          <div className="ticket__stat">
            <span className="ticket__k">{t('entries.stake')}</span>
            <span className="ticket__v num">25</span>
          </div>
          <div className="ticket__stat ticket__stat--end">
            <span className="ticket__k">{t('entries.potential')}</span>
            <span className="ticket__v ticket__v--pay num">≈64</span>
          </div>
        </div>
      </div>
      <p className="mp-example__hint">{t('pv2.mp.ex.hint')}</p>
    </figure>
  );
}

const TX_ICON: Record<Tx['kind'], { icon: (p: { size?: number }) => ReactNode; tone: string }> = {
  stake: { icon: IconTicket, tone: 'cyan' },
  payout: { icon: IconTrophy, tone: 'lime' },
  refund: { icon: IconRefund, tone: 'yellow' },
  bonus: { icon: IconGift, tone: 'purple' },
  topup: { icon: IconPlus, tone: 'lime' },
};

function TxRow({ x, onOpen }: { x: Tx; onOpen?: () => void }) {
  const { icon: Icon, tone } = TX_ICON[x.kind];
  const body = (
    <>
      <span className={`mp-tx__icon mp-tx__icon--${tone}`}>
        <Icon size={18} />
      </span>
      <span className="mp-tx__main">
        <span className="mp-tx__title">{t(`wallet.tx.${x.kind}`)}</span>
        <span className="num mp-tx__meta ellipsis">
          {fmtDate(x.at, { day: 'numeric', month: 'short' })} · {fmtClock(x.at)}
          {x.entryId ? ` · ${x.entryId}` : ''}
        </span>
      </span>
      <span className={`num mp-tx__amt ${x.amount > 0 ? 'lime' : x.amount < 0 ? 'mp-tx__amt--neg' : ''}`}>
        {x.amount > 0 ? '+' : x.amount < 0 ? '−' : ''}
        {fmtNumber(Math.abs(x.amount))}
      </span>
      {onOpen && <IconChevron size={14} className="icon muted" />}
    </>
  );
  return onOpen ? (
    <button type="button" className="mp-tx" onClick={() => (haptic.tap(), onOpen())} aria-label={`${t(`wallet.tx.${x.kind}`)} ${x.amount > 0 ? '+' : ''}${fmtNumber(x.amount)}`}>
      {body}
    </button>
  ) : (
    <div className="mp-tx">{body}</div>
  );
}

function EntryCard({ e, onOpen }: { e: Entry; onOpen: () => void }) {
  const lang = getLang();
  const meta = CIRCUIT_META.find((c) => c.id === e.circuitId);
  const tx = poolTexts(e.pool);
  const state = e.state.toLowerCase();
  return (
    <Card className={`ticket ticket--${state}`} pad={false} onClick={onOpen} ariaLabel={`${tx.question} · ${t(`entries.${state === 'pending' ? 'pending' : state}`)}`}>
      <div className="ticket__main">
        <span className="ticket__icon" aria-hidden="true">
          <MechIcon pool={e.pool} size={20} />
        </span>
        <div className="ticket__info">
          <div className="ticket__kicker ellipsis">{tx.title}</div>
          <div className="ticket__q clamp-2">{tx.question}</div>
          <div className="ticket__meta">
            <Flag cc={meta?.countryCode} size={16} />
            <span className="ellipsis">
              {e.meetingName[lang] || meta?.name} · {fmtDate(e.createdAt, { day: 'numeric', month: 'short' })} {fmtClock(e.createdAt)}
            </span>
          </div>
        </div>
        <div className="ticket__side">
          {stateBadge(e)}
          <IconChevron size={16} className="icon muted" />
        </div>
      </div>
      <div className="ticket__perf" aria-hidden="true" />
      <div className="ticket__stats">
        <div className="ticket__stat ticket__stat--pick">
          <span className="ticket__k">{t('entries.yourPick')}</span>
          <span className="ticket__v ellipsis">{e.outcomeLabel}</span>
        </div>
        <div className="ticket__stat">
          <span className="ticket__k">{t('entries.stake')}</span>
          <span className="ticket__v num">{fmtNumber(e.stake)}</span>
        </div>
        <div className="ticket__stat ticket__stat--end">
          <span className="ticket__k">{e.state === 'PENDING' ? t('entries.potential') : t('entries.payout')}</span>
          <span className="ticket__v ticket__v--pay num">{e.state === 'PENDING' ? `≈${fmtNumber(potential(e))}` : fmtNumber(e.payout)}</span>
        </div>
      </div>
      {e.settlementHistory.length > 0 && (
        <div className="ticket__note">
          <span className="badge badge--yellow">{t('entries.corrected')}</span>
        </div>
      )}
    </Card>
  );
}

const VALUE_LABELS: Record<string, string> = {
  position: 'P',
  lap_time_ms: 'lap',
  stop_duration_ms: 'stop',
  lane_duration_ms: 'lane',
  sector_time_ms: 'sector',
};

function formatValue(k: string, v: string | number | boolean | null): string {
  if (v === null) return '—';
  if (typeof v === 'number' && /_ms$/.test(k)) return k.includes('lap') || k.includes('reference') ? fmtLap(v) : `${fmtNumber(v)} ms`;
  if (typeof v === 'string' && /_at$/.test(k) && !Number.isNaN(Date.parse(v))) return fmtClock(Date.parse(v), true);
  if (typeof v === 'string' && DRIVER_BY_ID[v]) return DRIVER_BY_ID[v]!.lastName;
  return String(v);
}

export function EntryScreen({ entryId }: { entryId: string }) {
  const back = useNav((s) => s.back);
  const entry = useWallet((s) => s.entries.find((e) => e.id === entryId));
  const runner = useLive((s) => s.runner);
  const [busy, setBusy] = useState(false);
  const events = useMemo(() => {
    if (!entry?.settlement || !runner || runner.manifest.session_id !== entry.sessionId) return [];
    const ids = new Set(entry.settlement.evidence_source_event_ids);
    return runner.events.filter((e) => ids.has(e.source_event_id));
  }, [entry?.settlement, runner, entry?.sessionId]);
  const lang = getLang();
  const paused = useFeedPaused();
  if (!entry) {
    return (
      <div className="mypools">
        <SubHeader onBack={back} title={t('mp.ticket')} />
        <div className="card">
          <EmptyState art="empty-picks" title={t('entries.empty')} compact />
        </div>
      </div>
    );
  }
  const tx = poolTexts(entry.pool);
  const s = entry.settlement;
  const winner = s?.winner_outcome_id ? entry.pool.outcomes.find((o) => o.id === s.winner_outcome_id) : null;
  const isActive = runner?.manifest.session_id === entry.sessionId;
  const meta = CIRCUIT_META.find((c) => c.id === entry.circuitId);
  const state = entry.state.toLowerCase();
  const mult = entry.finalMultiplier ?? entry.estimate;
  const headline = entry.state === 'WON' ? t('mp.youWon') : entry.state === 'LOST' ? t('mp.notThisTime') : entry.state === 'VOID' ? t('mp.refunded') : t('mp.awaiting');
  const amount =
    entry.state === 'WON' ? `+${fmtNumber(entry.payout)}` : entry.state === 'LOST' ? `−${fmtNumber(entry.stake)}` : entry.state === 'VOID' ? fmtNumber(entry.payout) : `≈${fmtNumber(potential(entry))}`;

  return (
    <div className="mypools">
      <SubHeader onBack={back} title={t('mp.ticket')} right={stateBadge(entry)} />

      <div className={`card xticket xticket--${state}`}>
        <div className="xticket__hero">
          <Obj name={STATE_OBJ[entry.state]} size={64} className="xticket__obj" />
          <div className="xticket__headline">
            <span className="xticket__label">{headline}</span>
            <span className="xticket__amount num">
              {amount} <small>PULSE</small>
            </span>
          </div>
        </div>
        <div className="xticket__body">
          <div className="ticket__kicker xticket__kicker">
            <span className="xticket__mech" aria-hidden="true">
              <MechIcon pool={entry.pool} size={16} />
            </span>
            {tx.title}
          </div>
          <h1 className="xticket__q">{tx.question}</h1>
          {tx.anchor && <div className="xticket__anchor">{tx.anchor}</div>}
          <div className="ticket__meta">
            <Flag cc={meta?.countryCode} size={16} />
            <span>{entry.meetingName[lang] || meta?.name}</span>
          </div>
        </div>
        <div className="ticket__perf" aria-hidden="true" />
        <div className="xticket__grid">
          <div className="xticket__cell xticket__cell--pick">
            <span className="ticket__k">{t('entries.yourPick')}</span>
            <span className="xticket__v">{entry.outcomeLabel}</span>
          </div>
          <div className="xticket__cell">
            <span className="ticket__k">{t('entries.stake')}</span>
            <span className="xticket__v num">
              <Obj name="coin" size={18} /> {fmtNumber(entry.stake)}
            </span>
          </div>
          <div className="xticket__cell">
            <span className="ticket__k">{entry.finalMultiplier !== null ? t('mp.finalMultiplier') : t('mp.estMultiplier')}</span>
            <span className="xticket__v num cyan">×{mult.toFixed(2)}</span>
          </div>
          <div className="xticket__cell xticket__cell--pay">
            <span className="ticket__k">{entry.state === 'PENDING' ? t('entries.potential') : t('entries.payout')}</span>
            <span className="xticket__v xticket__v--pay num">{entry.state === 'PENDING' ? `≈${fmtNumber(potential(entry))}` : fmtNumber(entry.payout)}</span>
          </div>
        </div>
        <div className="xticket__ids num">
          <span>
            {t('mp.placedAt')} {fmtDate(entry.createdAt, { day: 'numeric', month: 'short' })} {fmtClock(entry.createdAt, true)}
          </span>
          <span className="ellipsis">
            {t('mp.ticketId')} {entry.id}
          </span>
          <span className="ellipsis">
            {t('mp.poolId')} {entry.pool.pool_id}
          </span>
        </div>
        <div className="xticket__chequer" aria-hidden="true" />
      </div>

      {paused && isActive && entry.state === 'PENDING' && <OfflineState compact />}

      {!s && entry.state === 'PENDING' && !isActive && (
        <Card className="mt xticket-await">
          <p className="xticket-await__txt">{t('entries.awaitReplay')}</p>
          <button
            className="btn btn--primary btn--block"
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={async () => {
              haptic.impact('medium');
              setBusy(true);
              await settleFromReplay(entry);
              setBusy(false);
            }}
          >
            {busy ? t('ui.loading') : t('entries.settleNow')}
          </button>
        </Card>
      )}
      {busy && !s && (
        <div className="mt">
          <SkelList rows={3} />
        </div>
      )}

      {s && (
        <>
          <Card className="mt proof">
            <div className="proof__title">{t('entries.proof')}</div>
            {winner && (
              <ProofRow k={t('entries.winner')}>
                <b className="lime">
                  {t(winner.label_key, Object.fromEntries(Object.entries(winner.label_params ?? {}).map(([k, v]) => [k, typeof v === 'string' && DRIVER_BY_ID[v] ? DRIVER_BY_ID[v]!.lastName : v])))}
                </b>
              </ProofRow>
            )}
            {s.void_reason && (
              <ProofRow k={t('entries.voidReason')}>
                <b className="yellow">{t(`f1.void.${s.void_reason.toLowerCase()}`)}</b>
              </ProofRow>
            )}
            <ProofRow k={t('entries.rule')} block>
              {tx.rule}
            </ProofRow>
            <ProofRow k={t('pool.determinedBy')} block>
              {tx.determinant}
            </ProofRow>
            <ProofRow k={t('entries.determinedAt')}>
              <span className="num">{fmtClock(Date.parse(s.determined_at), true)}</span>
            </ProofRow>
            <ProofRow k={t('entries.revision')}>
              <span className="num">
                #{s.settlement_revision} {s.provisional ? `· ${t('entries.provisional')}` : ''} · {s.template_version}
              </span>
            </ProofRow>
          </Card>
          <Card className="mt">
            <div className="proof__title">{t('entries.measured')}</div>
            <div className="values">
              {Object.entries(s.normalized_values).map(([k, v]) => (
                <div key={k} className="values__row">
                  <span className="muted">{VALUE_LABELS[k] ?? k.replace(/_/g, ' ')}</span>
                  <span className="num values__v">{formatValue(k, v)}</span>
                </div>
              ))}
              {Object.keys(s.normalized_values).length === 0 && <div className="muted">{t('f1.result.none')}</div>}
            </div>
          </Card>
          <div className="mt">
            <Collapsible title={`${t('entries.evidence')} (${s.evidence_source_event_ids.length})`} defaultOpen={s.evidence_source_event_ids.length <= 4}>
              <div className="evidence">
                {s.evidence_source_event_ids.map((id) => {
                  const ev = events.find((e) => e.source_event_id === id);
                  return (
                    <div key={id} className="evidence__row">
                      <span className="evidence__dot" aria-hidden="true" />
                      <div className="evidence__main">
                        <div className="evidence__type">{ev?.type ?? 'EVENT'}</div>
                        <div className="num ellipsis evidence__id">{id}</div>
                        <div className="muted num evidence__meta">
                          rev {s.evidence_revisions[id] ?? '1'} {ev ? `· ${fmtClock(Date.parse(ev.occurred_at), true)} · ${ev.source_product}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Collapsible>
          </div>
          {entry.settlementHistory.length > 0 && (
            <Card className="mt">
              <div className="row" style={{ gap: 8 }}>
                <span className="badge badge--yellow">{t('entries.corrected')}</span>
              </div>
              <div className="values">
                {entry.settlementHistory.map((h: Settlement) => (
                  <div key={h.settlement_revision} className="values__row">
                    <span className="muted">
                      {t('entries.prevValue')} · #{h.settlement_revision}
                    </span>
                    <span className="num values__v">{h.winner_outcome_id ?? h.void_reason}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ProofRow({ k, children, block }: { k: string; children: ReactNode; block?: boolean }) {
  return (
    <div className={`proof__row ${block ? 'proof__row--block' : ''}`}>
      <span className="proof__k">{k}</span>
      <span className="proof__v">{children}</span>
    </div>
  );
}
