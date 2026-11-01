import { useEffect, useState, type ReactNode } from 'react';
import { useSettings, resolveQuality, type MotionSetting, type QualitySetting, type ReminderSetting, type RenderMode } from '@/store/settings';
import { useWallet } from '@/store/wallet';
import { useRewards } from '@/store/rewards';
import { useToasts } from '@/store/toasts';
import { SubHeader } from '@/app/Header';
import { Segmented } from '@/ui/kit';
import { IconChevron, IconInfo, IconWarning, LogoPulse } from '@/ui/icons';
import { t, type Lang } from '@/i18n/core';
import { haptic, insideTelegram, setHapticsEnabled } from '@/telegram/sdk';
import { setSoundEnabled, sfx } from '@/audio/sfx';
import { PageHead, PortalSheet, Reveal, Toggle, useBack } from './common';
import '@/styles/screens/settings.css';

/** Applies persisted preferences to the haptics/sfx modules and the motion CSS hooks. */
export function useApplySettings(): void {
  const haptics = useSettings((s) => s.haptics);
  const sound = useSettings((s) => s.sound);
  const motion = useSettings((s) => s.motion);
  useEffect(() => setHapticsEnabled(haptics), [haptics]);
  useEffect(() => setSoundEnabled(sound), [sound]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', motion === 'reduced');
    root.classList.toggle('motion-auto', motion === 'system');
  }, [motion]);
}

/** One row style for the whole screen, matching the live "View" sheet: title + hint on the left, control on the right. */
function Row({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row">
      <span className="set-row__txt">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {children}
    </div>
  );
}

/** Row whose control (a segmented choice) takes the full width under the title. */
function Block({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row set-row--block">
      <span className="set-row__txt">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const back = useBack();
  const s = useSettings();
  const toast = useToasts((x) => x.push);
  const [confirm, setConfirm] = useState(false);
  const resolved = resolveQuality(s.quality);

  const reset = () => {
    useWallet.getState().reset();
    useRewards.getState().reset();
    haptic.notify('warning');
    sfx.warn();
    setConfirm(false);
    toast({ kind: 'warn', title: t('settings.resetDone') });
  };

  return (
    <>
      <SubHeader onBack={back} />
      <PageHead title={t('settings.title')} />

      <Reveal i={0} className="section">
        <h2 className="set-h">{t('pv2.set.lang')}</h2>
        <div className="card set-group">
          <div className="set-row set-row--block">
            <Segmented<Lang>
              label={t('settings.language')}
              value={s.lang}
              onChange={(lang) => s.set({ lang })}
              options={[
                { id: 'ru', label: 'Русский' },
                { id: 'en', label: 'English' },
              ]}
            />
          </div>
        </div>
      </Reveal>

      <Reveal i={1} className="section">
        <h2 className="set-h">{t('pv2.set.view')}</h2>
        <div className="card set-group">
          <Block title={t('settings.quality')} sub={s.quality === 'auto' ? t('scr.settings.autoIs', { q: t(`settings.q.${resolved}`) }) : t('scr.settings.qualitySub')}>
            <Segmented<QualitySetting>
              label={t('settings.quality')}
              value={s.quality}
              onChange={(quality) => s.set({ quality })}
              options={(['auto', 'low', 'medium', 'high'] as const).map((q) => ({ id: q, label: t(`settings.q.${q}`) }))}
            />
          </Block>
          <Block title={t('settings.render')} sub={s.renderMode === '3d' ? t('scr.settings.render3d') : t('scr.settings.render2d')}>
            <Segmented<RenderMode>
              label={t('settings.render')}
              value={s.renderMode}
              onChange={(renderMode) => s.set({ renderMode })}
              options={[
                { id: '3d', label: t('live.view3d') },
                { id: '2d', label: t('live.view2d') },
              ]}
            />
          </Block>
          <Block title={t('settings.motion')} sub={t('scr.settings.motionSub')}>
            <Segmented<MotionSetting>
              label={t('settings.motion')}
              value={s.motion}
              onChange={(motion) => s.set({ motion })}
              options={(['system', 'reduced', 'full'] as const).map((m) => ({ id: m, label: t(`scr.settings.m.${m}`) }))}
            />
          </Block>
          <Row title={t('settings.zones')} sub={t('scr.settings.zonesSub')}>
            <Toggle on={s.showZones} label={t('settings.zones')} onChange={(showZones) => s.set({ showZones })} />
          </Row>
        </div>
      </Reveal>

      <Reveal i={2} className="section">
        <h2 className="set-h">{t('scr.settings.feedback')}</h2>
        <div className="card set-group">
          <Row title={t('settings.haptics')} sub={t('scr.settings.hapticsSub')}>
            <Toggle
              on={s.haptics}
              label={t('settings.haptics')}
              onChange={(haptics) => {
                s.set({ haptics });
                setHapticsEnabled(haptics);
                if (haptics) haptic.impact('medium');
              }}
            />
          </Row>
          <Row title={t('settings.sound')} sub={t('scr.settings.soundSub')}>
            <Toggle
              on={s.sound}
              label={t('settings.sound')}
              onChange={(sound) => {
                s.set({ sound });
                setSoundEnabled(sound);
                if (sound) sfx.confirm();
              }}
            />
          </Row>
        </div>
      </Reveal>

      <Reveal i={3} className="section">
        <h2 className="set-h">{t('rem.group')}</h2>
        <div className="card set-group">
          <Block title={t('rem.setting')} sub={s.reminderMin === 0 ? t('rem.sub.off') : t('rem.sub.on', { n: s.reminderMin })}>
            <Segmented<`${ReminderSetting}`>
              label={t('rem.setting')}
              value={`${s.reminderMin}`}
              onChange={(v) => s.set({ reminderMin: Number(v) as ReminderSetting })}
              options={(['0', '30', '60', '120'] as const).map((v) => ({ id: v, label: v === '0' ? t('rem.off') : t('rem.opt', { n: v }) }))}
            />
          </Block>
        </div>
        <p className="sc-fine">
          <IconInfo size={12} /> {t('rem.fine')}
        </p>
      </Reveal>

      <Reveal i={4} className="section">
        <h2 className="set-h">{t('settings.about')}</h2>
        <div className="card set-group">
          <div className="set-about">
            <LogoPulse className="set-about__logo" />
            <span className="set-row__txt">
              <b>
                PULSE <span className="lime">ARENA</span>
              </b>
              <small>{t('app.module')} · DEMO · v1.0.0</small>
            </span>
            <span className={`badge ${insideTelegram() ? 'badge--cyan' : 'badge--ghost'}`}>{insideTelegram() ? 'Telegram' : t('scr.settings.browser')}</span>
          </div>
          <p className="set-about__txt">{t('pv2.demo')}</p>
          <p className="set-about__txt set-about__txt--muted">{t('settings.attribution')}</p>
          <button
            type="button"
            className="set-row set-row--link"
            onClick={() => {
              haptic.tap();
              s.set({ onboarded: false });
            }}
          >
            <span className="set-row__txt">
              <b>{t('scr.settings.tour')}</b>
              <small>{t('scr.settings.tourSub')}</small>
            </span>
            <IconChevron size={16} className="icon muted" />
          </button>
        </div>
      </Reveal>

      <Reveal i={5} className="section">
        <button
          type="button"
          className="set-danger"
          onClick={() => {
            haptic.impact('medium');
            setConfirm(true);
          }}
        >
          <IconWarning size={18} />
          {t('settings.reset')}
        </button>
        <p className="sc-fine">
          <IconInfo size={12} /> {t('scr.settings.resetHint')}
        </p>
      </Reveal>

      <PortalSheet open={confirm} onClose={() => setConfirm(false)} label={t('settings.reset')} title={t('settings.reset')}>
        <div className="set-confirm">
          <span className="set-confirm__ic">
            <IconWarning size={28} />
          </span>
          <p>{t('scr.settings.resetBody')}</p>
          <div className="sc-btnrow sc-btnrow--split">
            <button className="btn btn--ghost" onClick={() => setConfirm(false)}>
              {t('ui.cancel')}
            </button>
            <button className="btn set-btn-danger" onClick={reset}>
              {t('scr.settings.resetConfirm')}
            </button>
          </div>
        </div>
      </PortalSheet>
    </>
  );
}
