import type { PauseItem } from '../core/worktime';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { Dialog } from './common';

/** Confirm an automatically detected break (gap between two sessions) or mark it as no break. */
export function GapDialog({ gap, onClose }: { gap: PauseItem | null; onClose: () => void }) {
  const { t, dur, time } = useI18n();

  async function set(value: 'pause' | 'off' | undefined) {
    if (gap?.sessionId) await repo.setGapBefore(gap.sessionId, value);
    onClose();
  }

  return (
    <Dialog open={!!gap} title={t('gap.title')} onClose={onClose}>
      {gap && gap.start !== null && gap.end !== null && (
        <p>
          <strong>{dur(gap.minutes / 60)}</strong> · {time(gap.start)}–{time(gap.end)}
        </p>
      )}
      <p className="hint">{t('gap.hint')}</p>
      <div className="stack">
        <button className="btn primary" onClick={() => set('pause')}>
          {t('gap.confirm')}
        </button>
        <button className="btn" onClick={() => set('off')}>
          {t('gap.off')}
        </button>
        {gap?.confirmed && (
          <button className="btn" onClick={() => set(undefined)}>
            {t('gap.reset')}
          </button>
        )}
        <button className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </Dialog>
  );
}
