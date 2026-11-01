import { useMemo, type CSSProperties } from 'react';
import { DRIVERS, DRIVER_BY_ID, TEAM_BY_ID, type Driver } from '@/data/teams';
import { getMeeting } from '@/data/calendar';
import { CHANNELS } from '@/demo/channels';
import { driverSeason } from '@/demo/results';
import { useLive } from '@/store/live';
import { useNav } from '@/store/nav';
import { useSettings } from '@/store/settings';
import { SubHeader } from '@/app/Header';
import { Card, DriverAvatar, TyreBadge } from '@/ui/kit';
import { Flag } from '@/ui/Obj';
import { IconChevron, IconEye, IconPit, IconStar, IconTimer, IconTrophy } from '@/ui/icons';
import { fmtGap, fmtLap, fmtNumber, getLang, t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { Bar, Reveal, useBack } from './common';
import { DriverHero } from '@/ui/races/DriverHero';
import { KV } from '@/ui/races/meeting';
import { NotFound } from './Races';

export { countryName } from '@/ui/races/util';

export function DriverScreen({ driverId }: { driverId: string }) {
  const back = useBack();
  const d = DRIVER_BY_ID[driverId];
  if (!d) return <NotFound onBack={back} />;
  return <DriverBody d={d} />;
}

function DriverBody({ d }: { d: Driver }) {
  const back = useBack();
  const push = useNav((s) => s.push);
  const team = TEAM_BY_ID[d.teamId]!;
  const fav = useSettings((s) => s.favoriteDriver);
  const setSettings = useSettings((s) => s.set);
  const car = useLive((s) => s.live?.cars.find((c) => c.id === d.id) ?? null);
  const totalCars = useLive((s) => s.live?.cars.length ?? 0);
  const channelId = useLive((s) => s.channelId);
  const ch = CHANNELS.find((c) => c.id === channelId);
  const season = useMemo(() => driverSeason(d.id, Date.now()), [d.id]);
  const mate = DRIVERS.find((x) => x.teamId === d.teamId && x.id !== d.id);
  const isFav = fav === d.id;
  const style = { '--team': team.color, '--team2': team.livery.secondary } as CSSProperties;

  const follow = () => {
    haptic.impact('medium');
    sfx.select();
    useLive.getState().setFollow(d.id);
    useNav.getState().go('live');
  };

  return (
    <>
      <SubHeader
        title={`${d.firstName} ${d.lastName}`}
        onBack={back}
        right={
          <button
            className="icon-btn sc-favbtn"
            aria-pressed={isFav}
            aria-label={t('profile.favorite')}
            onClick={() => {
              haptic.impact('light');
              sfx.tap();
              setSettings({ favoriteDriver: isFav ? null : d.id });
            }}
          >
            <IconStar size={18} />
          </button>
        }
      />
      <Reveal i={0}>
        <DriverHero d={d} isFav={isFav} />
      </Reveal>

      <Reveal i={1} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('scr.driver.live')}</h2>
          {ch && <span className="sc-note">DEMO · {t(`session.${ch.sessionType}`)}</span>}
        </div>
        <Card glow={!!car} className="dr-live">
          {car ? (
            <>
              <div className="dr-live__top">
                <div className="dr-live__pos">
                  <span className="dr-live__k">{t('scr.driver.pos')}</span>
                  <span className="dr-live__posv">
                    <b className="num">P{car.position}</b>
                    <i className="num">/{totalCars}</i>
                  </span>
                </div>
                <div className="dr-live__gap">
                  <span className="dr-live__k">{car.position === 1 ? t('scr.driver.leading') : t('scr.driver.gap')}</span>
                  <b className="num">{car.position === 1 ? '—' : fmtGap(car.gapMs, 3)}</b>
                </div>
                <div className="dr-live__tyre">
                  <TyreBadge compound={car.tyre} size={30} />
                  <span>
                    <span className="num">{car.tyreAgeLaps}</span> {t('scr.driver.lapsShort')}
                  </span>
                </div>
              </div>
              <div className="rc-kvgrid">
                <KV k={t('scr.driver.lastLap')} v={fmtLap(car.lastLapMs)} />
                <KV k={t('scr.driver.bestLap')} v={fmtLap(car.bestLapMs)} tone="purple" />
                <KV k={t('scr.driver.stops')} v={String(car.pitStops)} />
              </div>
              <div className="dr-live__status">
                <span className={`badge ${car.status === 'ACTIVE' ? 'badge--lime' : 'badge--red'}`}>{t(`status.${car.status}`)}</span>
                {car.gridPosition > 0 && (
                  <span className="muted">
                    {t('scr.driver.grid', { n: car.gridPosition })}
                    {car.gridPosition !== car.position && (
                      <b className={car.gridPosition > car.position ? 'lime' : 'red'}>
                        {' '}
                        {car.gridPosition > car.position ? '▲' : '▼'}
                        {Math.abs(car.gridPosition - car.position)}
                      </b>
                    )}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="dr-live__none">
              <IconTimer size={20} />
              {t('scr.driver.notLive')}
            </div>
          )}
          <button className="btn btn--primary btn--block" onClick={follow}>
            <IconEye size={18} />
            {t('scr.driver.follow')}
          </button>
        </Card>
      </Reveal>

      <Reveal i={2} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('scr.driver.season')}</h2>
          <span className="sc-note">DEMO</span>
        </div>
        <div className="sc-statgrid">
          <div className="sc-stat sc-stat--hl">
            <span className="sc-stat__v num">P{season.rank}</span>
            <span className="sc-stat__k">{t('scr.driver.champ')}</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat__v num">{fmtNumber(season.points)}</span>
            <span className="sc-stat__k">{t('scr.driver.points')}</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat__v num">{season.wins}</span>
            <span className="sc-stat__k">{t('scr.driver.wins')}</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat__v num">{season.podiums}</span>
            <span className="sc-stat__k">{t('scr.driver.podiums')}</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat__v num">{season.poles}</span>
            <span className="sc-stat__k">{t('scr.driver.poles')}</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat__v num">{season.avgFinish === null ? '—' : fmtNumber(season.avgFinish, 1)}</span>
            <span className="sc-stat__k">{t('scr.driver.avg')}</span>
          </div>
        </div>
        {season.form.length > 0 && (
          <Card className="dr-form">
            <div className="dr-form__k">{t('scr.driver.form')}</div>
            <div className="dr-form__row">
              {season.form.map((f) => {
                const m = getMeeting(f.meetingId);
                const tone = f.dnf ? 'dnf' : f.pos === 1 ? 'win' : f.pos <= 3 ? 'pod' : f.pos <= 10 ? 'pts' : 'out';
                return (
                  <button key={f.meetingId} className="dr-form__chip" data-tone={tone} onClick={() => push({ name: 'meeting', meetingId: f.meetingId })} aria-label={`${m.name[getLang()]}: ${f.dnf ? 'DNF' : `P${f.pos}`}`}>
                    <b className="num">{f.dnf ? 'DNF' : `P${f.pos}`}</b>
                    <Flag cc={m.countryCode} size={18} />
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </Reveal>

      <Reveal i={3} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('scr.driver.traits')}</h2>
          <span className="sc-note">{t('scr.driver.traitsNote')}</span>
        </div>
        <Card className="dr-traits">
          {(
            [
              ['pace', d.pace, 'lime'],
              ['racecraft', d.racecraft, 'cyan'],
              ['consistency', d.consistency, 'purple'],
            ] as const
          ).map(([k, v, tone]) => (
            <div key={k} className="dr-trait">
              <span className="dr-trait__k">{t(`scr.driver.${k}`)}</span>
              <Bar value={v} max={1} tone={tone} label={t(`scr.driver.${k}`)} />
              <b className="num">{Math.round(v * 100)}</b>
            </div>
          ))}
        </Card>
      </Reveal>

      <Reveal i={4} className="section rc-sec">
        <div className="section__head">
          <h2 className="section__title">{t('scr.driver.team')}</h2>
        </div>
        <Card className="dr-team">
          <div className="dr-team__head" style={style}>
            <span className="dr-team__swatch" aria-hidden="true" />
            <div>
              <b>{team.name}</b>
              <div className="muted">{t('scr.driver.engine', { e: team.engine })}</div>
            </div>
          </div>
          <div className="rc-kvgrid rc-kvgrid--2">
            <KV k={t('scr.driver.carPace')} v={String(Math.round(team.carPace * 100))} />
            <div className="rc-kv">
              <span className="rc-kv__v">
                <IconPit size={14} /> <span className="num">{fmtNumber(team.pitCrewMs / 1000, 2)}</span> {t('scr.s')}
              </span>
              <span className="rc-kv__k">{t('scr.driver.pitCrew')}</span>
            </div>
          </div>
          {mate && (
            <button className="dr-mate" onClick={() => push({ name: 'driver', driverId: mate.id })}>
              <DriverAvatar id={mate.id} size={36} />
              <span className="dr-mate__txt">
                <span className="muted">{t('scr.driver.teammate')}</span>
                <b>
                  {mate.firstName} {mate.lastName}
                </b>
              </span>
              <span className="num muted">#{mate.number}</span>
              <IconChevron size={14} />
            </button>
          )}
        </Card>
        <p className="sc-fine">
          <IconTrophy size={12} /> {t('scr.driver.demoNote')}
        </p>
      </Reveal>
    </>
  );
}
