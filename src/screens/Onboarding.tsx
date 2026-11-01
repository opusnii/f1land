import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSettings } from '@/store/settings';
import { Art } from '@/ui/Art';
import { DisplayTitle, Tagline } from '@/ui/primitives';
import { IconChevron, LogoPulse } from '@/ui/icons';
import { t } from '@/i18n/core';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { useReduced } from './common';
import '@/styles/screens/onboarding.css';

/** Three full-screen art slides (spec §9.6). Focal points keep each subject clear of the bottom copy. */
const SLIDES = [
  { art: 'onb-1-lights', focal: '50% 22%', h: 'pv2.onb.h1', p: 'pv2.onb.p1' },
  { art: 'onb-2-zones', focal: '45% 18%', h: 'pv2.onb.h2', p: 'pv2.onb.p2' },
  { art: 'onb-3-swipe', focal: '62% 30%', h: 'pv2.onb.h3', p: 'pv2.onb.p3' },
] as const;
const STEPS = SLIDES.length;

export function Onboarding() {
  const onboarded = useSettings((s) => s.onboarded);
  const set = useSettings((s) => s.set);
  const reduced = useReduced();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    if (!onboarded) setStep(0);
  }, [onboarded]);

  const finish = () => {
    haptic.notify('success');
    sfx.confirm();
    set({ onboarded: true });
  };
  const goTo = (n: number) => {
    if (n < 0 || n >= STEPS || n === step) return;
    haptic.tap();
    sfx.tap();
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const next = () => (step < STEPS - 1 ? goTo(step + 1) : finish());
  const last = step === STEPS - 1;
  const slide = SLIDES[step]!;
  const copyAnim = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: 40 * dir }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -28 * dir } };

  return (
    <AnimatePresence>
      {!onboarded && (
        <motion.div
          className="onb"
          role="dialog"
          aria-modal="true"
          aria-label={t('onb.title')}
          data-reduced={reduced || undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.32 }}
        >
          {/* All plates stay mounted so the next one is decoded before it fades in. */}
          <div className="onb__plates" aria-hidden="true">
            {SLIDES.map((s, i) => (
              <Art key={s.art} name={s.art} priority={i === 0} scrim="b" focal={s.focal} sizes="100vw" className="onb__plate" style={{ opacity: i === step ? 1 : 0 }} />
            ))}
          </div>

          <div className="onb__top">
            <div className="logo-lockup onb__logo" aria-label="Pulse Arena">
              <LogoPulse className="logo-lockup__mark" />
              <span className="logo-lockup__word" aria-hidden="true">
                PULSE <b>ARENA</b>
              </span>
            </div>
            <button type="button" className="sc-onb__skip onb__skip" onClick={finish}>
              {t('scr.onb.skip')}
            </button>
          </div>

          <motion.div
            className="onb__stage"
            drag={reduced ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -400) goTo(step + 1);
              else if (info.offset.x > 60 || info.velocity.x > 400) goTo(step - 1);
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} className="onb__copy" {...copyAnim} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                <DisplayTitle as="h2" size="lg" className="onb__title">
                  {t(slide.h)}
                </DisplayTitle>
                <p className="onb__p">{t(slide.p)}</p>
                {last && <Tagline className="onb__tag">{t('tag.onboarding')}</Tagline>}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <div className="onb__foot">
            <div className="onb__dots" role="tablist" aria-label={t('onb.title')}>
              {SLIDES.map((s, i) => (
                <button key={s.art} type="button" role="tab" aria-selected={i === step} aria-label={t('pv2.onb.step', { n: i + 1, m: STEPS })} onClick={() => goTo(i)}>
                  <span />
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--primary btn--lg btn--block onb__go" onClick={next}>
              {last ? t('onb.go') : t('scr.onb.next')}
              <IconChevron size={18} />
            </button>
            <p className="onb__demo">{t('pv2.demo')}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
