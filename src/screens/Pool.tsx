import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLive } from '@/store/live';
import { useNav } from '@/store/nav';
import { useSettings } from '@/store/settings';
import { usePools, multiplier } from '@/demo/poolEngine';
import { useWallet, type Entry } from '@/store/wallet';
import { getEngine } from '@/app/sessionService';
import { useSceneView, webglAvailable } from '@/app/SceneHost';
import { useSessionNow } from '@/app/hooks';
import { layoutOf, outcomeLabel, poolTexts, type PoolLayout } from '@/app/poolText';
import { canAcceptEntry, canResumeDraft, entryBlockReason, msUntilLock } from '@/domain/lifecycle';
import { getTemplate } from '@/domain/markets/catalog';
import type { Pool } from '@/domain/types';
import type { CameraMode } from '@/three/engine/cameraRig';
import { CHANNELS } from '@/demo/channels';
import { fmtClock, fmtNumber, fmtOdds, getLang, t } from '@/i18n/core';
import { Collapsible, Help, Sheet } from '@/ui/kit';
import { DisplayTitle, StatusChip } from '@/ui/primitives';
import { LockTimer } from '@/ui/LockTimer';
import { IconCheck, IconChevron, IconInfo, IconLock, IconPit, IconTarget, IconTimer, IconTyre, IconUsers } from '@/ui/icons';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { useReduced } from '@/screens/common';
import { FamilyVisual, OutcomeGrid, outcomeIcon } from '@/ui/bet/poolFamilies';
import { PoolHero } from '@/ui/bet/PoolHero';
import { FlagGlyph, IcCoins, IcLink, IcPodium, IcStopwatch, IcSwords } from '@/ui/bet/icons';
import { MIN_STAKE, TicketDock } from '@/ui/bet/TicketDock';
import { InPlayCard, PoolStateCard } from '@/ui/bet/ResultCard';
import { CountUp, Sparks } from '@/ui/bet/motionBits';
import '@/styles/pool.css';

/** Unsent selection per pool. Restored only for the same session, pool and version while accepting (F1-044). */
interface Draft {
  session_id: string;
  pool_id: string;
  version: number;
  outcome: string | null;
  stake: number;
}
const drafts = new Map<string, Draft>();
/** The 3D scene is opt-in on pool screens (spec §7.3); the choice holds for the session. */
let prefer3d = false;

const LAYOUT_ICON: Record<PoolLayout, (p: { size?: number }) => ReactNode> = {
  zone: (p) => <IconTarget size={p.size} />,
  duel: (p) => <IcSwords size={p.size} />,
  pit: (p) => <IconPit size={p.size} />,
  tyre: (p) => <IconTyre size={p.size} />,
  pace: (p) => <IcStopwatch size={p.size} />,
  incident: (p) => <FlagGlyph color="#ffd12e" size={p.size} />,
  position: (p) => <IcPodium size={p.size} />,
  quali: (p) => <IconTimer size={p.size} />,
  combo: (p) => <IcLink size={p.size} />,
};

/**
 * 3D framing per family (audit R7): a chase cam on a car in the garage or on a pit wall looks into a wall,
 * so pools about the order of the field use the whole-track overview; a duel follows A with B as the rival.
 */
function cameraFor(pool: Pool, layout: PoolLayout): CameraMode {
  switch (layout) {
    case 'duel':
      return pool.subject.driver_a ? 'follow' : 'overview';
    case 'pit':
    case 'tyre':
    case 'pace':
      return pool.subject.driver_a ? 'follow' : 'overview';
    default:
      return 'overview';
  }
}

type ConfirmState = { phase: 'checking' | 'ok' | 'rejected'; entry?: Entry; outcome: string; stake: number; mult: number };

export function PoolScreen({ poolId }: { poolId: string }) {
  const back = useNav((s) => s.back);
  const push = useNav((s) => s.push);
  const go = useNav((s) => s.go);
  const pools = usePools((s) => s.pools);
  const setFollow = useLive((s) => s.setFollow);
  const setRival = useLive((s) => s.setRival);
  const setScene = useSceneView((s) => s.set);
  const renderMode = useSettings((s) => s.renderMode);
  const balance = useWallet((s) => s.balance);
  const entries = useWallet((s) => s.entries);
  const reduced = useReduced();
  const now = useSessionNow();
  const lp = pools.find((p) => p.pool.pool_id === poolId) ?? null;
  const [outcome, setOutcome] = useState<string | null>(() => {
    const d = drafts.get(poolId);
    const lp0 = usePools.getState().pools.find((p) => p.pool.pool_id === poolId);
    const r = useLive.getState().runner;
    return d && lp0 && canResumeDraft(d, lp0.pool, r?.ready ? r.nowMs : Date.now()) ? d.outcome : null;
  });
  const [stake, setStake] = useState<number>(() => drafts.get(poolId)?.stake ?? Math.min(25, Math.max(MIN_STAKE, Math.floor(useWallet.getState().balance))));
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [lockedPick, setLockedPick] = useState(false);
  const [mode3d, setMode3d] = useState(prefer3d);
  const submitting = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const pool = lp?.pool ?? null;
  const layout: PoolLayout = pool ? layoutOf(pool) : 'position';
  const subjectA = pool?.subject.driver_a;
  const subjectB = pool?.subject.driver_b;
  const can3d = renderMode === '3d' && webglAvailable();
  const show3d = mode3d && can3d;

  useEffect(() => {
    if (pool) drafts.set(poolId, { session_id: pool.session_id, pool_id: pool.pool_id, version: pool.version, outcome, stake });
  }, [poolId, pool, outcome, stake]);

  // Follow / rival drive both the neon map markers and the 3D framing (F1-050).
  const exists = lp !== null;
  useEffect(() => {
    if (!exists) return;
    if (subjectA) setFollow(subjectA);
    else if (lp?.focus[0]) setFollow(lp.focus[0]);
    setRival(subjectB ?? null);
    return () => setRival(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, exists]);

  // The scene host only runs when the user opts into 3D; the hero is a plate + SVG by default.
  useEffect(() => {
    if (!exists || !show3d) {
      setScene({ layout: 'hidden' });
      return;
    }
    setScene({ layout: 'top', labels: [subjectA, subjectB, ...(lp?.focus ?? [])].filter(Boolean) as string[], cameraOverride: pool ? cameraFor(pool, layout) : 'overview' });
    return () => setScene({ layout: 'hidden', zone: null, frameZone: false, labels: [], cameraOverride: null, frozen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, exists, show3d]);

  // The 3D section scrolls with the page (transform only — no canvas resize).
  useEffect(() => {
    if (!show3d) return;
    const scroller = rootRef.current?.closest<HTMLElement>('.screen');
    const host = document.querySelector<HTMLElement>('.scene-host');
    if (!scroller || !host) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = Math.min(scroller.scrollTop, host.offsetHeight + 80);
      host.style.transform = y > 0 ? `translate3d(0, ${-y}px, 0)` : '';
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      host.style.transform = '';
    };
  }, [poolId, show3d]);

  useEffect(() => {
    if (!pool || !show3d) return;
    let zone: 1 | 2 | 3 | null = null;
    if (pool.market_id === 'F1-M11' && outcome && /^S[123]$/.test(outcome)) zone = Number(outcome[1]) as 1 | 2 | 3;
    if (pool.market_id === 'F1-M19') zone = pool.target.parameters.sector ?? null;
    if (pool.target.parameters.combo) {
      const sec = pool.target.parameters.combo.find((c) => c.kind === 'SECTOR');
      if (sec) zone = Number(sec.value) as 1 | 2 | 3;
    }
    setScene({ zone, frameZone: zone !== null && pool.market_id === 'F1-M11' });
  }, [outcome, pool, setScene, show3d]);

  useEffect(() => {
    if (show3d) setScene({ frozen: confirm !== null });
  }, [confirm, setScene, show3d]);

  const accept = pool ? canAcceptEntry(pool, now) : false;
  const blockKey = pool ? entryBlockReason(pool, now) : null;
  const wasOpen = useRef(accept);
  useEffect(() => {
    if (wasOpen.current && !accept && outcome) {
      sfx.lock();
      setLockedPick(true);
    }
    wasOpen.current = accept;
  }, [accept, outcome]);
  // The "locked" dock explains a lost selection for a moment, then gets out of the way.
  useEffect(() => {
    if (!lockedPick) return;
    const id = setTimeout(() => setLockedPick(false), 8000);
    return () => clearTimeout(id);
  }, [lockedPick]);

  const myEntries = useMemo(() => entries.filter((e) => e.poolId === poolId), [entries, poolId]);

  if (!lp || !pool) {
    return (
      <div className="pl">
        <PoolHead onBack={back} layout="position" title={t('pool.title')} />
        <section className="pl-gone" role="status">
          <span className="pl-gone__ico" aria-hidden="true">
            <IconLock size={26} />
          </span>
          <h1 className="pl-gone__t">{t('pool2.goneTitle')}</h1>
          <p className="pl-gone__s">{t('pool2.goneSub')}</p>
          {myEntries.length > 0 && (
            <button type="button" className="pl-gone__entry" onClick={() => push({ name: 'entry', entryId: myEntries[0]!.id })}>
              <span>{t('pool2.goneEntry', { o: myEntries[0]!.outcomeLabel })}</span>
              <IconChevron size={16} />
            </button>
          )}
          <div className="pl-gone__btns">
            <button type="button" className="btn btn--primary" onClick={() => go('live')}>
              {t('pool2.goneLive')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => go('pools')}>
              {t('pool2.goneMine')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const tx = poolTexts(pool);
  const templ = getTemplate(pool.market_id);
  const mult = outcome ? multiplier(lp.book, outcome, stake) : null;
  const totalPool = Object.values(lp.book.stakes).reduce((a, b) => a + b, 0);
  const lang = getLang();
  const channel = CHANNELS.find((c) => c.id === useLive.getState().channelId);
  const selected = accept && outcome ? (pool.outcomes.find((o) => o.id === outcome) ?? null) : null;
  const myPicks = new Set(myEntries.map((e) => e.outcomeId));
  const msLeft = msUntilLock(pool, now);
  const totalMs = Date.parse(pool.closes_at) - Date.parse(pool.opens_at);
  const insufficient = balance < stake || balance < MIN_STAKE;
  const suspended = pool.intake_status === 'SUSPENDED';

  const pick = (id: string) => {
    if (!accept) return;
    setOutcome(id);
    // Keep the chosen card visible above the (expanding) ticket dock.
    window.setTimeout(() => {
      const tile = rootRef.current?.querySelector<HTMLElement>('.ot--on');
      const dock = rootRef.current?.querySelector<HTMLElement>('.tdock');
      const scroller = rootRef.current?.closest<HTMLElement>('.screen');
      if (!tile || !dock || !scroller) return;
      const over = tile.getBoundingClientRect().bottom - dock.getBoundingClientRect().top + 12;
      if (over > 0) scroller.scrollBy({ top: over, behavior: reduced ? 'auto' : 'smooth' });
    }, 300);
  };

  const submit = () => {
    if (!outcome || submitting.current || confirm) return;
    // Local guard with server time: a pool that just locked never opens the sheet (QA17).
    if (!canAcceptEntry(pool, useLive.getState().runner?.nowMs ?? now)) return;
    submitting.current = true;
    const m = multiplier(lp.book, outcome, stake);
    setConfirm({ phase: 'checking', outcome, stake, mult: m });
    sfx.confirm();
    window.setTimeout(() => {
      submitting.current = false;
      const engine = getEngine();
      const r = useLive.getState().runner;
      const serverNow = r?.nowMs ?? Date.now();
      const current = usePools.getState().pools.find((p) => p.pool.pool_id === pool.pool_id)?.pool ?? pool;
      // Server-side check with server time: a pool locked during the open sheet is rejected (QA17).
      if (!engine || !r || !canAcceptEntry(current, serverNow) || useWallet.getState().balance < stake || !engine.placeEntry(pool.pool_id, outcome, stake, serverNow)) {
        haptic.notify('error');
        sfx.lose();
        setConfirm((c) => (c ? { ...c, phase: 'rejected' } : c));
        return;
      }
      const o = pool.outcomes.find((x) => x.id === outcome)!;
      const entry: Entry = {
        id: `E-${pool.pool_id.split(':').slice(-2).join('-')}-${Math.floor(serverNow / 1000) % 100000}`,
        poolId: pool.pool_id,
        channelId: r.channel.id,
        cycle: r.cycle,
        sessionId: r.manifest.session_id,
        marketId: pool.market_id,
        outcomeId: outcome,
        pool: current,
        questionKey: '',
        questionParams: {},
        outcomeLabel: outcomeLabel(o, pool.market_id),
        stake,
        estimate: m,
        createdAt: serverNow,
        state: 'PENDING',
        payout: 0,
        settlement: null,
        settlementHistory: [],
        finalMultiplier: null,
        circuitId: r.circuit.id,
        meetingName: channel?.title ?? { ru: '', en: '' },
        seen: true,
      };
      useWallet.getState().addEntry(entry);
      haptic.notify('success');
      setConfirm((c) => (c ? { ...c, phase: 'ok', entry } : c));
      setOutcome(null);
      drafts.delete(poolId);
    }, 900);
  };

  const ctaSub = selected && mult ? t('pool2.swipeSub', { stake: fmtNumber(stake), ret: fmtNumber(Math.round(stake * mult)) }) : undefined;
  const showDock = accept || lockedPick;
  const confirmOutcome = confirm ? pool.outcomes.find((o) => o.id === confirm.outcome) : undefined;
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <div className={`pl pl--${layout} ${showDock ? 'pl--dock' : ''}`} ref={rootRef}>
      <PoolHead onBack={back} layout={layout} title={tx.title} right={<LockTimer variant="pill" haptics ms={msLeft} totalMs={totalMs} accept={accept} status={pool.status} suspended={suspended} />} />

      <PoolHero
        lp={lp}
        layout={layout}
        outcome={accept ? outcome : null}
        accept={accept}
        onPickSector={(s) => pick(`S${s}`)}
        mode3d={show3d}
        can3d={can3d}
        onToggle3d={() => {
          prefer3d = !show3d;
          setMode3d(!show3d);
        }}
      />

      {/* Question + anchor (never truncated — QA20) */}
      <section className="pl-q">
        <DisplayTitle as="p" size="md" icon={LAYOUT_ICON[layout]({ size: 22 })} className="pl-q__mech">
          {t(`pv2.family.${layout}`)}
        </DisplayTitle>
        <h1 className="pl-q__title">{tx.question}</h1>
        <p className="pl-q__line">
          <IconTimer size={15} />
          <span>{tx.anchor ?? tx.window}</span>
          <span className="pl-q__det">{tx.determinant}</span>
        </p>
        <div className="pl-q__meta">
          {/* One status on screen: the header timer shows the closed state, so the chip only appears while accepting. */}
          {accept && <StatusChip status={pool.status} accept suspended={suspended} />}
          <PoolPulse players={lp.book.players} total={totalPool} />
        </div>
      </section>

      {accept ? <InPlayCard lp={lp} entries={myEntries} onOpen={(id) => push({ name: 'entry', entryId: id })} /> : <PoolStateCard lp={lp} entries={myEntries} blockKey={blockKey} onOpen={(id) => push({ name: 'entry', entryId: id })} />}

      <FamilyVisual lp={lp} layout={layout} />

      <section className="pl-pick" aria-labelledby="pl-pick-t">
        <div className="pl-sec">
          <h2 className="pl-sec__t" id="pl-pick-t">
            {accept ? t('pool.choose') : pool.status === 'SETTLED' ? t('pl.result') : t('pl.outcomes')}
          </h2>
          <span className="pl-sec__r">
            {accept ? (
              <span className="pl-sec__live techlabel">
                <i aria-hidden="true" /> {t('pl.liveOdds')}
              </span>
            ) : lp.book.finalMultipliers ? (
              <span className="pl-sec__final">{t('pl.finalOdds')}</span>
            ) : null}
            <Help text={t('pool.estimateHint')} />
          </span>
        </div>
        <OutcomeGrid lp={lp} layout={layout} value={accept ? outcome : null} onChange={pick} disabled={!accept} stake={stake} myPicks={myPicks} />
      </section>

      <HowItWorks />

      <Collapsible title={t('pool.rules')} icon={<IconInfo size={18} />}>
        <p className="rules__text">{tx.rule}</p>
        <dl className="rules__dl">
          <dt>{t('pool.determinedBy')}</dt>
          <dd>{tx.determinant}</dd>
          <dt>{t('pool.window')}</dt>
          <dd>{tx.window}</dd>
          {tx.anchor && (
            <>
              <dt>{t('pool.anchor')}</dt>
              <dd>{tx.anchor}</dd>
            </>
          )}
          <dt>SC / VSC</dt>
          <dd>{tx.scVsc}</dd>
          <dt>RED</dt>
          <dd>{tx.red}</dd>
          <dt>{t('pool.deadline')}</dt>
          <dd className="num">
            {fmtClock(Date.parse(pool.settlement_deadline), true)} UTC{fmtOffset()}
          </dd>
          <dt>{t('pool.versions')}</dt>
          <dd className="num pl-rules__ver">
            {pool.template_version} · {pool.ruleset_version} · {pool.circuit_layout_version} · {pool.provider_schema_version}
          </dd>
        </dl>
        <p className="pl-rules__note">{t('pool.dataNote')}</p>
        <p className="pl-rules__note">
          {templ.family} · {pool.market_id} · {lang.toUpperCase()}
        </p>
      </Collapsible>

      {showDock && (
        <TicketDock
          locked={!accept}
          pick={selected && mult ? { label: outcomeLabel(selected, pool.market_id), icon: outcomeIcon(selected, pool, 20), odds: mult, share: totalPool > 0 ? (lp.book.stakes[selected.id] ?? 0) / totalPool : null } : null}
          stake={stake}
          onStake={setStake}
          balance={balance}
          msLeft={msLeft}
          totalMs={totalMs}
          ctaLabel={!accept ? t('pool2.headerLocked') : insufficient ? t('pool.insufficient') : t('pool.swipe')}
          ctaSub={ctaSub}
          canConfirm={accept && !!selected && !insufficient && confirm === null}
          reason={accept && selected && insufficient ? t('pool.insufficient') : undefined}
          onConfirm={submit}
          onClear={() => {
            haptic.tap();
            setOutcome(null);
          }}
          lockedText={t(blockKey ?? 'pool2.lockedPick')}
        />
      )}

      <Sheet open={confirm !== null} onClose={() => confirm?.phase !== 'checking' && setConfirm(null)} title={t('confirm.title')} label={t('confirm.title')}>
        {confirm && confirmOutcome && (
          <div className={`cf cf--${confirm.phase}`}>
            <div className="cf__ticket">
              <div className="cf__q">
                <span className="cf__k">{t('confirm.question')}</span>
                <b>{tx.question}</b>
                {tx.anchor && (
                  <span className="cf__anchor">
                    <IconTimer size={13} /> {tx.anchor}
                  </span>
                )}
              </div>
              <div className="cf__perf" aria-hidden="true" />
              <div className="cf__pick">
                <span className="cf__pick-icon">{outcomeIcon(confirmOutcome, pool, 22)}</span>
                <div className="cf__pick-text">
                  <span className="cf__k">{t('confirm.outcome')}</span>
                  <b>{outcomeLabel(confirmOutcome, pool.market_id)}</b>
                </div>
                <span className="cf__odds num">{fmtOdds(confirm.mult)}x</span>
                <AnimatePresence>
                  {confirm.phase === 'ok' && confirm.entry && (
                    <motion.div
                      key="stamp"
                      className="cf__stamp"
                      initial={reduced ? { opacity: 0, rotate: -9 } : { scale: 1.6, opacity: 0, rotate: -18 }}
                      animate={{ scale: 1, opacity: 1, rotate: -9 }}
                      transition={{ duration: reduced ? 0.12 : 0.32, ease }}
                    >
                      <span>{t('pool2.stamp')}</span>
                      <small className="num">{confirm.entry.id}</small>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <dl className="cf__grid">
                <div>
                  <dt>{t('confirm.window')}</dt>
                  <dd>{tx.window}</dd>
                </div>
                <div>
                  <dt>{t('confirm.amount')}</dt>
                  <dd className="num">{fmtNumber(confirm.stake)} PULSE</dd>
                </div>
                <div>
                  <dt>{t('pool.potential')}</dt>
                  <dd className="num lime">≈ {fmtNumber(Math.round(confirm.stake * confirm.mult))} PULSE</dd>
                </div>
                <div>
                  <dt>{t('confirm.mode')}</dt>
                  <dd>
                    <span className="cf__demo">DEMO</span> {t('confirm.modeDemo')}
                  </dd>
                </div>
              </dl>
              <Sparks fire={confirm.phase === 'ok' ? 1 : 0} count={22} spread={110} />
            </div>
            <AnimatePresence mode="wait">
              {confirm.phase === 'checking' && (
                <motion.div key="c" className="cf__state" initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }} role="status">
                  <span className="cf__spin" />
                  <span>{t('confirm.checking')}</span>
                  <span className="cf__bar" aria-hidden="true" />
                </motion.div>
              )}
              {confirm.phase === 'ok' && confirm.entry && (
                <motion.div key="ok" className="cf__state cf__state--ok" initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease }} role="status">
                  <span className="cf__check">
                    <IconCheck size={22} />
                  </span>
                  <div>
                    <b>{t('confirm.confirmed')}</b>
                    <div className="cf__id num">
                      {t('confirm.entryId')}: {confirm.entry.id}
                    </div>
                  </div>
                </motion.div>
              )}
              {confirm.phase === 'rejected' && (
                <motion.div key="rej" className="cf__state cf__state--bad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} role="alert">
                  <IconLock size={20} /> <span>{t('confirm.rejectedLocked')}</span>
                </motion.div>
              )}
            </AnimatePresence>
            {confirm.phase === 'ok' && (
              <div className="cf__btns">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setConfirm(null);
                    go('live');
                  }}
                >
                  {t('confirm.track')}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)}>
                  {t('pool2.stay')}
                </button>
              </div>
            )}
            {confirm.phase === 'rejected' && (
              <div className="cf__btns">
                <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)}>
                  {t('ui.close')}
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function fmtOffset(): string {
  const off = -new Date().getTimezoneOffset();
  const h = Math.floor(Math.abs(off) / 60);
  const m = Math.abs(off) % 60;
  return off === 0 ? '' : ` ${off > 0 ? '+' : '−'}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/* ------------------------------------------------------------------ */

function PoolHead({ onBack, layout, title, right }: { onBack: () => void; layout: PoolLayout; title: string; right?: ReactNode }) {
  return (
    <header className="pl-head">
      <button
        type="button"
        className="pl-head__back"
        aria-label={t('ui.back')}
        onClick={() => {
          haptic.tap();
          onBack();
        }}
      >
        <IconChevron dir="left" size={20} />
      </button>
      <span className="pl-head__icon" aria-hidden="true">
        {LAYOUT_ICON[layout]({ size: 18 })}
      </span>
      <div className="pl-head__title">{title}</div>
      {right}
    </header>
  );
}

/** Truthful social proof from the DEMO pool book. */
function PoolPulse({ players, total }: { players: number; total: number }) {
  return (
    <div className="pl-pulse" aria-label={`${t('pool.participants', { n: fmtNumber(players) })} · ${fmtNumber(total)} PULSE ${t('pool2.inPool')}`}>
      <span className="pl-pulse__item">
        <IconUsers size={14} />
        <CountUp className="num" value={players} />
        <small>{t('pool2.playing')}</small>
      </span>
      <span className="pl-pulse__item">
        <IcCoins size={14} />
        <CountUp className="num" value={total} />
        <small>PULSE {t('pool2.inPool')}</small>
      </span>
    </div>
  );
}

/** "How it works" row → three-step sheet (heuristic 10: help in context). */
function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="pl-how"
        aria-haspopup="dialog"
        onClick={() => {
          haptic.tap();
          setOpen(true);
        }}
      >
        <span className="pl-how__i" aria-hidden="true">
          <IconInfo size={18} />
        </span>
        <span className="pl-how__t">{t('sys.howItWorks')}</span>
        <span className="pl-how__steps" aria-hidden="true">
          <i>1</i>
          <i>2</i>
          <i>3</i>
        </span>
        <IconChevron size={16} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('sys.howItWorks')} label={t('sys.howItWorks')}>
        <ol className="how">
          {[1, 2, 3].map((i) => (
            <li key={i} className="how__step">
              <span className="how__n num" aria-hidden="true">
                {i}
              </span>
              <div className="how__text">
                <b>{t(`sys.how.${i}`)}</b>
                <p>{t(`pv2.how.${i}d`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Sheet>
    </>
  );
}
