/* Live "View" sheet: render mode (3D / 2D art), camera, sector zones and the DEMO director panel. */
import { useLive } from '@/store/live';
import { useSettings, resolveQuality, type RenderMode } from '@/store/settings';
import type { CameraMode } from '@/three/engine/cameraRig';
import { t } from '@/i18n/core';
import { useSceneView, getScene, webglAvailable, chooseLiveRender, useRenderMode } from '@/app/SceneHost';
import { Segmented, Sheet } from '@/ui/kit';
import { Toggle } from '@/screens/common';
import { IconEye, IconWarning } from '@/ui/icons';
import { haptic } from '@/telegram/sdk';
import { sfx } from '@/audio/sfx';
import { CAMERA_ICON, FlagGlyph, RcBadge } from '@/ui/bet/icons';

const CAMS: CameraMode[] = ['director', 'follow', 'tv', 'heli', 'onboard', 'orbit', 'overview'];

/** Everything about how the race is shown lives in one sheet behind the header's view button. */
export function ViewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const camera = useSettings((s) => s.camera);
  const quality = useSettings((s) => s.quality);
  const renderMode = useRenderMode('full');
  const showZones = useSettings((s) => s.showZones);
  const setSettings = useSettings((s) => s.set);
  const webglLost = useSceneView((s) => s.webglLost);
  const can3d = !webglLost && webglAvailable();
  return (
    <Sheet open={open} onClose={onClose} title={t('lv.view.title')} label={t('lv.view.title')}>
      <div className="lv-view">
        {can3d && (
          <Segmented<RenderMode>
            label={t('hl.view.mode')}
            value={renderMode}
            onChange={(v) => chooseLiveRender(v)}
            options={[
              { id: '3d', label: t('live.view3d') },
              { id: '2d', label: t('hl.view.art') },
            ]}
          />
        )}
        {can3d && renderMode === '2d' && resolveQuality(quality) === 'low' && <p className="lv-view__hint">{t('hl.view.lowHint')}</p>}
        {can3d && renderMode === '3d' && (
          <section className="lv-view__sec">
            <h3 className="lv-view__h">{t('live.camera')}</h3>
            <div className="lv-cam__grid" role="radiogroup" aria-label={t('live.camera')}>
              {CAMS.map((c) => {
                const I = CAMERA_ICON[c];
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={camera === c}
                    className={`lv-cam__item ${camera === c ? 'lv-cam__item--on' : ''}`}
                    onClick={() => {
                      haptic.impact('light');
                      sfx.select();
                      setSettings({ camera: c });
                    }}
                  >
                    {I && <I size={20} />}
                    <span>{t(`live.cam.${c}`)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <div className="lv-view__row">
          <span className="lv-view__txt">
            <b>{t('lv.view.zones')}</b>
            <small>{t('lv.view.zonesSub')}</small>
          </span>
          <Toggle on={showZones} label={t('live.zones')} onChange={(v) => setSettings({ showZones: v })} />
        </div>
        <section className="lv-view__sec">
          <h3 className="lv-view__h">{t('live.directorPanel')}</h3>
          <DirectorPanel onClose={onClose} />
        </section>
      </div>
    </Sheet>
  );
}

function DirectorPanel({ onClose }: { onClose: () => void }) {
  const runner = useLive((s) => s.runner);
  const sim = runner?.sim as unknown as { trigger?: (k: 'SC' | 'VSC' | 'RED' | 'RETIRE') => void } | undefined;
  return (
    <div className="lv-dir">
      <p className="lv-dir__note">{t('app.demoNote')}</p>
      <div className="lv-dir__grid">
        {(['SC', 'VSC', 'RED'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="lv-dir__btn"
            disabled={!sim?.trigger}
            onClick={() => {
              haptic.impact('medium');
              sim?.trigger?.(k);
              onClose();
            }}
          >
            {k === 'RED' ? <FlagGlyph color="#ff3b47" size={20} /> : <RcBadge text={k} size={18} />}
            <span>{t(`live.trigger.${k.toLowerCase()}`)}</span>
          </button>
        ))}
        <button
          type="button"
          className="lv-dir__btn"
          onClick={() => {
            haptic.impact('medium');
            runner?.setStale(true);
            setTimeout(() => runner?.setStale(false), 12000);
            onClose();
          }}
        >
          <IconWarning size={20} />
          <span>{t('live.trigger.stale')}</span>
        </button>
        <button
          type="button"
          className="lv-dir__btn"
          onClick={() => {
            getScene()?.loseContext();
            onClose();
          }}
        >
          <IconEye size={20} />
          <span>{t('live.trigger.webgl')}</span>
        </button>
      </div>
      <div className="lv-dir__foot">
        <IconEye size={14} /> {t('live.approxNote')}
      </div>
    </div>
  );
}
