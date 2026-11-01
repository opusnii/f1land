import type { CSSProperties } from 'react';
import { TEAM_BY_ID, type Driver } from '@/data/teams';
import { t } from '@/i18n/core';
import { TeamBar } from '@/ui/kit';
import { Helmet } from '@/ui/Helmet';
import { CarArt, Flag } from '@/ui/Obj';
import { IconStar } from '@/ui/icons';
import { DisplayTitle } from '@/ui/primitives';
import { countryName } from './util';

/** Driver identity: team-tinted panel, helmet and team car renders, race number as an Exo 2 outline. */
export function DriverHero({ d, isFav }: { d: Driver; isFav: boolean }) {
  const team = TEAM_BY_ID[d.teamId]!;
  const style = { '--team': team.color, '--team2': team.livery.secondary } as CSSProperties;
  return (
    <section className="dr-hero" style={style}>
      <span className="dr-hero__num" aria-hidden="true">
        {d.number}
      </span>
      <CarArt team={d.teamId} width={236} className="dr-hero__car" />
      <Helmet driverId={d.id} size={108} num={false} ring decorative className="dr-hero__helmet" />
      <div className="dr-hero__txt">
        <span className="dr-hero__first">{d.firstName}</span>
        <DisplayTitle as="h1" size="lg" className="dr-hero__last">
          {d.lastName}
        </DisplayTitle>
        <span className="dr-hero__team">
          <TeamBar id={d.id} />
          {team.name}
        </span>
        <span className="dr-hero__nat">
          <Flag cc={d.countryCode} size={20} />
          <span>
            {countryName(d.countryCode)} · <b className="num">#{d.number}</b> · {d.code}
          </span>
        </span>
        {isFav && (
          <span className="dr-hero__fav">
            <IconStar size={12} />
            {t('scr.driver.yourFav')}
          </span>
        )}
      </div>
    </section>
  );
}
