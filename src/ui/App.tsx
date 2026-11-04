import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';
import { AppDataProvider, useStoredProfile } from './AppData';
import { CalendarPage } from './CalendarPage';
import { LogPage } from './LogPage';
import { Onboarding } from './Onboarding';
import { SettingsPage } from './SettingsPage';
import { StatsPage } from './StatsPage';
import { startAutoSync, useSyncState } from './sync';
import { TrackPage } from './TrackPage';
import { repo } from '../data/repo';
import { Icon, type IconName } from './icons';

const TABS = [
  { id: 'track', label: 'nav.track', Page: TrackPage },
  { id: 'log', label: 'nav.log', Page: LogPage },
  { id: 'calendar', label: 'nav.calendar', Page: CalendarPage },
  { id: 'stats', label: 'nav.stats', Page: StatsPage },
  { id: 'settings', label: 'nav.settings', Page: SettingsPage },
] as const satisfies readonly { id: IconName; label: MessageKey; Page: () => React.JSX.Element }[];

type TabId = (typeof TABS)[number]['id'];

function initialTab(): TabId {
  const hash = location.hash.slice(1);
  return (TABS.find((t) => t.id === hash)?.id ?? 'track') as TabId;
}

export function App() {
  const stored = useStoredProfile();
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>(initialTab);
  const sync = useSyncState();

  useEffect(() => {
    void repo.normalizeBreaks().finally(startAutoSync);
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
    window.scrollTo(0, 0);
  }, [tab]);

  if (stored === undefined) return <p className="muted center pad">{t('common.loading')}</p>;
  if (stored === null) return <Onboarding />;

  const { Page } = TABS.find((x) => x.id === tab)!;
  return (
    <AppDataProvider profile={stored.value}>
      <div className="app">
        <header className="topbar">
          <span className="brand">Timebank</span>
          <span className={`sync-dot ${sync.error ? 'error' : sync.busy ? 'busy' : sync.last ? 'ok' : ''}`} title={sync.error ?? ''} />
        </header>
        <main>
          <Page />
        </main>
        <nav className="tabbar">
          {TABS.map((x) => (
            <button key={x.id} className={x.id === tab ? 'active' : ''} onClick={() => setTab(x.id)} aria-current={x.id === tab ? 'page' : undefined}>
              <Icon name={x.id} />
              <span>{t(x.label)}</span>
            </button>
          ))}
        </nav>
      </div>
    </AppDataProvider>
  );
}
