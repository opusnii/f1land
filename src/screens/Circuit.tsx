import { useState } from 'react';
import type { CircuitData, CircuitMeta } from '@/data/circuits';
import { meetingForCircuit, type Meeting } from '@/data/calendar';
import { CHANNELS } from '@/demo/channels';
import { circuitPlate } from '@/assets';
import { useNav } from '@/store/nav';
import { SubHeader } from '@/app/Header';
import { Card, Collapsible, useNow } from '@/ui/kit';
import { IconCalendar, IconFlag, IconPlay } from '@/ui/icons';
import { Flag } from '@/ui/Obj';
import { DisplayTitle, HeroPlate } from '@/ui/primitives';
import { SECTOR_COLORS, TrackMap } from '@/ui/TrackMap';
import { fmtClock, fmtLap, fmtNumber, getLang, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { Reveal, safeMeta, useBack, useCircuit } from './common';
import { NotFound, watchChannel } from './Races';

/** Sector palette (spec §2), shared with the neon track: S1 lime, S2 cyan, S3 purple. */
export const SECTOR_TONES = SECTOR_COLORS;

type Sel = 0 | 1 | 2 | 3;

export function CircuitScreen({ circuitId }: { circuitId: string }) {
  const back = useBack();
  const meta = safeMeta(circuitId);
  if (!meta) return <NotFound onBack={back} />;
  return <CircuitBody circuitId={circuitId} meta={meta} />;
}

function sectorCorners(c: CircuitData, i: number): number {
  const s = c.sectors[i]!;
  return c.corners.filter((cn) => (s.endS > s.startS ? cn.s >= s.startS && cn.s < s.endS : cn.s >= s.startS || cn.s < s.endS)).length;
}

function sectorLen(c: CircuitData, i: number): number {
  const s = c.sectors[i]!;
  const len = s.endS - s.startS;
  return len > 0 ? len : len + c.centerlineLengthM;
}

function CircuitBody({ circuitId, meta }: { circuitId: string; meta: CircuitMeta }) {
  const back = useBack();
  const push = useNav((s) => s.push);
  const c = useCircuit(circuitId);
  const [sel, setSel] = useState<Sel>(0);
  const [turns, setTurns] = useState(true);
  const meeting = meetingForCircuit(circuitId);
  const ch = CHANNELS.find((x) => x.circuitId === circuitId);
  const lang = getLang();
  const pick = (n: 1 | 2 | 3) => {
    haptic.tap();
    setSel(sel === n ? 0 : n);
  };
  return (
    <>
      <SubHeader title={meta.shortName} onBack={back} />
      <Reveal i={0}>
        <section className="ci-hero">
          <HeroPlate art={circuitPlate(circuitId)} height={340} scrim="full" priority className="ci-plate">
            <div className="ci-head">
              <div className="ci-head__txt">
                <span className="ci-head__kicker">
                  <Flag cc={meta.countryCode} size={20} />
                  {meta.location}, {meta.country}
                </span>
                <DisplayTitle as="h1" size="sm" className="ci-head__name">
                  {meta.name}
                </DisplayTitle>
              </div>
              <div className="ci-head__len">
                <b className="num">{fmtNumber(meta.lengthM / 1000, 3)}</b>
                <span>{t('scr.km')}</span>
              </div>
            </div>
            {/* Fills what the title leaves, so long circuit names never sit on the track. */}
            <div className="ci-map">
              {c ? <TrackMap variant="neon" circuit={c} width={320} height={210} padding={20} showCorners={turns} selectedSector={sel || null} onSelectSector={pick} /> : <div className="skel ci-map__skel" />}
            </div>
          </HeroPlate>
          <div className="ci-panel">
            <div className="ci-legend">
              <span>
                <i className="ci-lg ci-lg--start" aria-hidden="true" />
                {t('scr.circuit.startFinish')}
              </span>
              <span>
                <i className="ci-lg ci-lg--pit" aria-hidden="true" />
                {t('scr.circuit.pit')}
              </span>
              <button type="button" className="ci-lg-btn" aria-pressed={turns} onClick={() => setTurns(!turns)}>
                {t('rv2.turnNumbers')}
              </button>
            </div>
            <div className="ci-secs" role="group" aria-label={t('scr.circuit.sectors')}>
              {([1, 2, 3] as const).map((n) => (
                <button key={n} type="button" className="ci-sec" aria-pressed={sel === n} style={{ ['--sec' as string]: SECTOR_COLORS[n - 1] }} onClick={() => pick(n)}>
                  <span className="ci-sec__k">S{n}</span>
                  <span className="ci-sec__v">
                    <span className="num">{c ? fmtNumber(sectorLen(c, n - 1) / 1000, 3) : '—'}</span> {t('scr.km')}
                  </span>
                  <span className="ci-sec__s">{c ? t('scr.circuit.nTurns', { n: sectorCorners(c, n - 1) }) : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal i={1} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('rv2.facts')}</h2>
        </div>
        <Facts meta={meta} c={c} meeting={meeting} />
      </Reveal>

      {c && c.corners.length > 0 && (
        <Reveal i={2} className="section rc-sec">
          <Collapsible title={t('scr.circuit.turnsList', { n: c.corners.length })} icon={<IconFlag size={18} />}>
            <div className="ci-turns">
              {c.corners.map((cn) => (
                <div key={cn.number} className="ci-turn">
                  <span className="ci-turn__n num">T{cn.number}</span>
                  <span className="ci-turn__name">{cn.name ?? (cn.direction === 'L' ? t('scr.circuit.left') : t('scr.circuit.right'))}</span>
                  <span className="ci-turn__dir" aria-hidden="true">
                    {cn.direction === 'L' ? '↰' : '↱'}
                  </span>
                  <span className="ci-turn__sev" role="img" aria-label={t('scr.circuit.severity', { n: cn.severity })}>
                    {[1, 2, 3, 4, 5, 6].map((k) => (
                      <i key={k} data-on={k <= cn.severity || undefined} />
                    ))}
                  </span>
                  <span className="ci-turn__r">
                    <span className="num">{Math.round(cn.radius)}</span> {t('scr.m')}
                  </span>
                </div>
              ))}
            </div>
          </Collapsible>
        </Reveal>
      )}

      <Reveal i={3} className="section rc-sec">
        <div className="rc-actions">
          {meeting && (
            <button className="btn btn--ghost" onClick={() => push({ name: 'meeting', meetingId: meeting.id })}>
              <IconCalendar size={16} />
              <span>{t('scr.races.weekend')}</span>
            </button>
          )}
          {ch && (
            <button className="btn btn--primary" onClick={() => watchChannel(ch)}>
              <IconPlay size={16} />
              <span>{t('races.watchDemo')}</span>
            </button>
          )}
        </div>
        {meeting && <p className="sc-fine">{t('scr.circuit.hosts', { name: meeting.name[lang], n: meeting.round })}</p>}
        <p className="sc-fine">{t('f1.data.approximate')}</p>
      </Reveal>
    </>
  );
}

interface Fact {
  k: string;
  v: string;
  unit?: string;
  tone?: string;
  /** Words, not digits: stays in the text face (the numeric face has no Cyrillic). */
  text?: boolean;
}

/** Key/value table of what the circuit data actually holds; rows without data are left out. */
function Facts({ meta, c, meeting }: { meta: CircuitMeta; c: CircuitData | null; meeting: Meeting | undefined }) {
  const now = useNow(15_000);
  const km = t('scr.km');
  const rows: Fact[] = [
    { k: t('races.length'), v: fmtNumber(meta.lengthM / 1000, 3), unit: km },
    { k: t('races.laps'), v: String(meta.laps) },
  ];
  if (c?.sprintLaps && meeting?.sprint) rows.push({ k: t('rv2.sprintLaps'), v: String(c.sprintLaps) });
  rows.push({ k: t('scr.circuit.distance'), v: fmtNumber((meta.lengthM * meta.laps) / 1000, 1), unit: km });
  if (c?.lapRecordMs) rows.push({ k: t('races.record'), v: fmtLap(c.lapRecordMs), tone: 'purple' });
  if (c) rows.push({ k: t('scr.circuit.turns'), v: String(c.corners.length) });
  rows.push({ k: t('races.direction'), v: t(meta.direction === 'CW' ? 'races.cw' : 'races.ccw'), text: true });
  if (c) {
    rows.push(
      { k: t('scr.circuit.zones'), v: String(c.straightZones.length) },
      { k: t('scr.circuit.pitLane'), v: fmtNumber(c.pitLane.lengthM, 0), unit: t('scr.m') },
      { k: t('scr.circuit.pitLimit'), v: String(c.pitLane.speedLimitKph), unit: t('scr.kmh') },
      { k: t('scr.circuit.localTime'), v: fmtClock(now, false, c.timezone) },
    );
  }
  return (
    <Card pad={false}>
      <dl className="ci-facts">
        {rows.map((r) => (
          <div key={r.k} className="ci-fact">
            <dt>{r.k}</dt>
            <dd className={r.tone}>
              <span className={r.text ? undefined : 'num'}>{r.v}</span>
              {r.unit && <i>{r.unit}</i>}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
