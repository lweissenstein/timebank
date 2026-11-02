import { useState } from 'react';
import { loadSyncConfig, saveSyncConfig, type SyncConfig } from '../data/githubSync';
import { useI18n } from '../i18n';
import { syncNow, useSyncState } from './sync';

const EMPTY: SyncConfig = { owner: '', repo: 'timebank-data', path: 'timebank.json', branch: '', token: '' };

export function SyncSettings({ onConnected }: { onConnected?: () => void }) {
  const { t, time } = useI18n();
  const [config, setConfig] = useState<SyncConfig>(() => loadSyncConfig() ?? EMPTY);
  const [connected, setConnected] = useState(() => loadSyncConfig() !== null);
  const state = useSyncState();

  const field = (key: keyof SyncConfig, label: string, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        value={config[key] ?? ''}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => setConfig({ ...config, [key]: e.target.value.trim() })}
      />
    </label>
  );

  async function connect() {
    saveSyncConfig({ ...config, branch: config.branch || undefined });
    setConnected(true);
    await syncNow();
    onConnected?.();
  }

  function disconnect() {
    saveSyncConfig(null);
    setConnected(false);
  }

  return (
    <div className="form-grid">
      <p className="hint">{t('settings.syncHint')}</p>
      <div className="row">
        {field('owner', t('settings.owner'))}
        {field('repo', t('settings.repo'))}
      </div>
      <div className="row">
        {field('path', t('settings.path'))}
        {field('branch', t('settings.branch'))}
      </div>
      {field('token', t('settings.token'), 'password')}
      <div className="toolbar">
        <button className="btn primary" disabled={!config.owner || !config.repo || !config.token || state.busy} onClick={connect}>
          {state.busy ? '…' : t('settings.syncNow')}
        </button>
        {connected && (
          <button className="btn" onClick={disconnect}>
            {t('settings.disconnect')}
          </button>
        )}
      </div>
      {state.last && <p className="muted small">{t('settings.lastSync', { time: time(state.last.at), status: t(`settings.syncStatus.${state.last.status}`) })}</p>}
      {state.error && <p className="warning">{state.error}</p>}
    </div>
  );
}
