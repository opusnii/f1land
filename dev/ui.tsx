/**
 * Design-system kitchen sink (spec §8): every shared component in every state.
 *   /dev/ui.html?lang=ru|en&only=type,buttons,…
 * The reference for screenshots: node dev/shot-ui.mjs.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/app.css';
import '@/styles/system.css';
import '@/styles/pool.css';
import { registerDict, setLang, t } from '@/i18n/core';
import { UI_DICTS } from '@/i18n/ui';
import { F1_I18N } from '@/domain/markets/i18n';
import { registerFeatureDicts } from '@/i18n/extra';
import { loadCircuit, type CircuitData } from '@/data/circuits';
import { DRIVERS, TEAMS } from '@/data/teams';
import { ASSETS } from '@/assets/manifest';
import { poolPlate } from '@/assets';
import { Art } from '@/ui/Art';
import { CarArt, Flag, Obj } from '@/ui/Obj';
import { Helmet } from '@/ui/Helmet';
import { DisplayTitle, EmptyState, HeroPlate, StatusChip, Tagline } from '@/ui/primitives';
import { LockTimer } from '@/ui/LockTimer';
import { TrackMap } from '@/ui/TrackMap';
import { LogoPulse } from '@/ui/icons';

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en' ? 'en' : 'ru';
registerDict('ru', { ...UI_DICTS.ru, ...F1_I18N.ru });
registerDict('en', { ...UI_DICTS.en, ...F1_I18N.en });
registerFeatureDicts();
setLang(lang);
const only = params.get('only')?.split(',');

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  if (only && !only.includes(id)) return null;
  return (
    <section className="section" data-block={id} style={{ marginBottom: 32 }}>
      <h2 className="section__title" style={{ marginBottom: 12 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' } as const;

function Sink() {
  const [circuit, setCircuit] = useState<CircuitData | null>(null);
  useEffect(() => {
    void loadCircuit('mx-1962').then(setCircuit);
  }, []);
  const objects = Object.entries(ASSETS).filter(([, a]) => a.g === 'objects').map(([n]) => n);
  const badges = Object.entries(ASSETS).filter(([, a]) => a.g === 'badges').map(([n]) => n);
  return (
    <div className="screen" style={{ position: 'static', overflow: 'visible', padding: 16, maxWidth: 430, margin: '0 auto' }}>
      <header className="topbar">
        <div className="brand logo-lockup">
          <LogoPulse className="logo-lockup__mark" />
          <span className="logo-lockup__word">
            PULSE <b>ARENA</b>
          </span>
        </div>
        <div className="topbar__spacer" />
        <span className="balance-chip">
          <Obj name="coin" size={22} className="balance-chip__coin" />
          <span className="balance-chip__val num">1 250</span>
        </span>
        <span className="avatar-btn">
          <Helmet driverId="nor" size={38} />
        </span>
      </header>

      <Block id="type" title="Типографика">
        <DisplayTitle size="lg">{lang === 'ru' ? 'Пит-стоп' : 'Pit stop'}</DisplayTitle>
        <DisplayTitle size="md">{lang === 'ru' ? 'Дуэль пилотов' : 'Driver duel'}</DisplayTitle>
        <DisplayTitle size="sm">{lang === 'ru' ? 'Зона на трассе' : 'Track zone'}</DisplayTitle>
        <p style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 4px' }}>{lang === 'ru' ? 'Кто первым подтверждённо обгонит соперника?' : 'Who completes the first confirmed pass?'}</p>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>{lang === 'ru' ? 'Окно 17:22–17:24 · результат по хронометражу' : 'Window 17:22–17:24 · decided by timing'}</p>
        <div style={{ ...row, margin: '12px 0' }}>
          <span className="techlabel">LIVE</span>
          <span className="techlabel">{lang === 'ru' ? 'Круг' : 'Lap'} 5/34</span>
          <span className="techlabel">S2</span>
          <b className="num" style={{ fontSize: 32 }}>×2,54</b>
          <b className="num" style={{ fontSize: 20 }}>12:59</b>
        </div>
        <Tagline>{t('tag.home')}</Tagline>
      </Block>

      <Block id="buttons" title="Кнопки">
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn--primary btn--block">
            <span>{lang === 'ru' ? 'Сделать прогноз' : 'Make a pick'}</span>
          </button>
          <button className="btn btn--primary btn--block" data-state="loading">
            <span>{lang === 'ru' ? 'Сделать прогноз' : 'Make a pick'}</span>
          </button>
          <button className="btn btn--primary btn--block" data-state="success">
            <span>{lang === 'ru' ? 'Сделать прогноз' : 'Make a pick'}</span>
          </button>
          <div>
            <button className="btn btn--primary btn--block" disabled>
              <span>{lang === 'ru' ? 'Сделать прогноз' : 'Make a pick'}</span>
            </button>
            <p className="btn__reason">{lang === 'ru' ? 'Сначала выберите исход' : 'Pick an outcome first'}</p>
          </div>
          <div style={row}>
            <button className="btn btn--ghost">{lang === 'ru' ? 'Правила' : 'Rules'}</button>
            <button className="btn btn--ghost btn--sm">{lang === 'ru' ? 'Сменить' : 'Change'}</button>
          </div>
        </div>
      </Block>

      <Block id="tiles" title="Плитки S2">
        <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['S1', 'S2', 'S3'].map((s, i) => (
            <div key={s} className="tile" role="radio" aria-checked={i === 1} style={{ padding: 12, opacity: i === 1 ? 1 : 0.72 }}>
              <span className="techlabel">{s}</span>
              <b className="num" style={{ display: 'block', fontSize: 20, marginTop: 6 }}>×{[2.54, 3.24, 4.85][i]}</b>
            </div>
          ))}
        </div>
      </Block>

      <Block id="status" title="Статусы и таймеры">
        <div style={row}>
          <StatusChip status="OPEN" accept />
          <StatusChip status="OPEN" accept={false} suspended />
          <StatusChip status="OPEN" accept={false} />
          <StatusChip status="RESOLVING" accept={false} />
          <StatusChip status="SETTLED" accept={false} />
          <StatusChip status="VOID" accept={false} />
        </div>
        <div style={{ ...row, marginTop: 12 }}>
          <LockTimer ms={779_000} totalMs={900_000} accept status="OPEN" />
          <LockTimer ms={24_000} totalMs={900_000} accept status="OPEN" />
          <LockTimer ms={7_000} totalMs={900_000} accept status="OPEN" />
          <LockTimer ms={0} totalMs={900_000} accept={false} status="LOCKED" />
        </div>
        <div style={{ ...row, marginTop: 12 }}>
          <LockTimer variant="ring" ms={779_000} totalMs={900_000} accept status="OPEN" />
          <LockTimer variant="ring" ms={24_000} totalMs={900_000} accept status="OPEN" />
          <LockTimer variant="ring" ms={7_000} totalMs={900_000} accept status="OPEN" />
          <LockTimer variant="ring" ms={0} totalMs={900_000} accept={false} status="LOCKED" />
        </div>
      </Block>

      <Block id="helmets" title="Шлемы">
        <div style={row}>
          {TEAMS.map((tm) => {
            const d = DRIVERS.find((x) => x.teamId === tm.id)!;
            return <Helmet key={tm.id} driverId={d.id} size={48} />;
          })}
          <Helmet teamId={null} size={48} />
        </div>
        <div style={{ ...row, marginTop: 10 }}>
          <Helmet driverId="lec" size={24} />
          <Helmet driverId="lec" size={36} ring />
          <Helmet driverId="lec" size={64} ring />
          <Helmet driverId="ver" size={96} />
        </div>
      </Block>

      <Block id="cars" title="Болиды">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <CarArt team="mclaren" width={180} mirror />
          <CarArt team="ferrari" width={180} />
        </div>
      </Block>

      <Block id="objects" title="Объекты и значки">
        <div style={row}>
          {objects.map((n) => (
            <Obj key={n} name={n} size={48} alt={n} />
          ))}
        </div>
        <div style={{ ...row, marginTop: 10 }}>
          {badges.map((n) => (
            <Obj key={n} name={n} size={48} alt={n} />
          ))}
        </div>
        <div style={{ ...row, marginTop: 10 }}>
          {['mx', 'gb', 'nl', 'it', 'mc', 'jp', 'ae', 'us', 'br', 'au'].map((c) => (
            <Flag key={c} cc={c} size={20} />
          ))}
        </div>
      </Block>

      <Block id="hero" title="Hero-плиты">
        <div style={{ display: 'grid', gap: 12 }}>
          {(['zone', 'duel', 'pit', 'tyre', 'pace', 'incident', 'position', 'quali', 'combo'] as const).map((f, i) => (
            <HeroPlate key={f} art={poolPlate(f)} height={150} scrim="l" focal="75% 50%" priority={i < 2}>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <DisplayTitle size="md">{f}</DisplayTitle>
              </div>
            </HeroPlate>
          ))}
        </div>
      </Block>

      <Block id="track" title="Неоновая трасса">
        <HeroPlate
          art="circuit-mx-1962"
          height={240}
          scrim="full"
          layer={
            circuit && (
              <TrackMap
                variant="neon"
                circuit={circuit}
                width={358}
                height={240}
                padding={28}
                selectedSector={2}
                sectorCallouts={{ 1: 'S1 · ×2,5', 2: 'S2 · 2,4 км · ×1,9', 3: 'S3 · ×4,9' }}
                cars={[
                  { id: 'lec', x: circuit.centerline[40]![0], y: circuit.centerline[40]![1], kind: 'follow', tag: 'P6 LEC +4.2s' },
                  { id: 'ver', x: circuit.centerline[120]![0], y: circuit.centerline[120]![1], kind: 'rival', position: 5 },
                  { id: 'nor', x: circuit.centerline[200]![0], y: circuit.centerline[200]![1], kind: 'other' },
                ]}
              />
            )
          }
        />
        <div className="card card--glass" style={{ marginTop: 12, padding: 16 }}>
          <span className="techlabel">S1-glass</span>
        </div>
      </Block>

      <Block id="empty" title="Пустые состояния">
        <div className="card">
          <EmptyState art="empty-picks" title={lang === 'ru' ? 'Пока нет прогнозов' : 'No picks yet'} body={lang === 'ru' ? 'Выберите пул в эфире — билет появится здесь.' : 'Pick a pool on the live screen; your ticket shows up here.'} action={<button className="btn btn--primary">{lang === 'ru' ? 'К эфиру' : 'Go live'}</button>} />
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <EmptyState compact art="empty-feed" title={lang === 'ru' ? 'Событий пока нет' : 'No events yet'} tagline={t('tag.live')} />
        </div>
      </Block>

      <Block id="art" title="Арт">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {['onb-1-lights', 'onb-2-zones', 'onb-3-swipe', 'cel-win', 'cel-loss', 'cel-levelup'].map((n) => (
            <Art key={n} name={n} ratio="2 / 3" sizes="130px" style={{ borderRadius: 12 }} />
          ))}
        </div>
      </Block>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Sink />);
