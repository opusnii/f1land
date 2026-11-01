import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useSettings } from '@/store/settings';
import { useCelebrate } from './store';
import type { LevelUp } from './extras';
import { WinMoment } from './WinMoment';
import { LossMoment } from './LossMoment';
import { LevelUpMoment } from './LevelUpMoment';
import './celebrate.css';

let levelSeq = 0;

/**
 * Renders the head of the settlement queue; the next moment waits for the previous one to leave.
 * A level-up crossed by a settlement plays as its own moment right after it.
 */
export function Celebration() {
  const head = useCelebrate((s) => s.queue[0]);
  const shift = useCelebrate((s) => s.shift);
  const onboarded = useSettings((s) => s.onboarded);
  const [level, setLevel] = useState<(LevelUp & { id: number }) | null>(null);

  const done = useCallback(
    (lu: LevelUp | null) => {
      shift();
      if (lu) setLevel({ ...lu, id: ++levelSeq });
    },
    [shift],
  );
  const closeLevel = useCallback(() => setLevel(null), []);

  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.VITE_E2E === '1')) return;
    Object.assign(window, { __levelUp: (from: number, to: number) => setLevel({ from, to, id: ++levelSeq }) });
  }, []);

  const shown = onboarded ? head : undefined;
  return (
    <AnimatePresence mode="wait">
      {level && onboarded ? (
        <LevelUpMoment key={`lv-${level.id}`} from={level.from} to={level.to} onDone={closeLevel} />
      ) : (
        shown && (shown.state === 'WON' ? <WinMoment key={shown.id} m={shown} onDone={done} /> : <LossMoment key={shown.id} m={shown} onDone={done} />)
      )}
    </AnimatePresence>
  );
}
