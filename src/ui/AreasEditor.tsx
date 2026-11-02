import type { Area, Profile } from '../core/types';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { slugId } from './common';

/** Rename, hide and add areas and categories. Ids stay stable so history is kept. */
export function AreasEditor({ profile }: { profile: Profile }) {
  const { t } = useI18n();

  const save = (areas: Area[]) => repo.saveProfile({ ...profile, areas });
  const updateArea = (id: string, patch: Partial<Area>) => save(profile.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  function addCategory(area: Area) {
    const name = prompt(t('settings.newCategory'));
    if (!name?.trim()) return;
    const id = slugId(name, area.categories.map((c) => c.id));
    updateArea(area.id, { categories: [...area.categories, { id, name: name.trim(), hidden: false }] });
  }

  function addArea() {
    const name = prompt(t('settings.newArea'));
    if (!name?.trim()) return;
    const id = slugId(name, profile.areas.map((a) => a.id));
    save([...profile.areas, { id, name: name.trim(), color: '#5b6b8c', countsAsWork: true, hidden: false, categories: [{ id: 'general', name: 'General', hidden: false }] }]);
  }

  return (
    <div className="areas-editor">
      {profile.areas.map((area) => (
        <details key={area.id} className={`area-edit ${area.hidden ? 'is-hidden' : ''}`}>
          <summary>
            <span className="dot" style={{ background: area.color }} /> {area.name}
            {!area.countsAsWork && <span className="badge">{t('common.notCounted')}</span>}
          </summary>
          <div className="form-grid">
            <div className="row">
              <label className="grow">
                {t('settings.areaName')}
                <input key={area.name} defaultValue={area.name} onBlur={(e) => e.target.value.trim() && e.target.value !== area.name && updateArea(area.id, { name: e.target.value.trim() })} />
              </label>
              <label>
                &nbsp;
                <input type="color" value={area.color} onChange={(e) => updateArea(area.id, { color: e.target.value })} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={area.countsAsWork} onChange={(e) => updateArea(area.id, { countsAsWork: e.target.checked })} />
              {t('settings.countsAsWork')}
            </label>
            <label className="check">
              <input type="checkbox" checked={area.thesisFlag !== false} onChange={(e) => updateArea(area.id, { thesisFlag: e.target.checked })} />
              {t('settings.thesisFlag')}
            </label>
            <label className="check">
              <input type="checkbox" checked={area.hidden} onChange={(e) => updateArea(area.id, { hidden: e.target.checked })} />
              {t('settings.hidden')}
            </label>
            <ul className="plain cat-list">
              {area.categories.map((c) => (
                <li key={c.id} className={c.hidden ? 'is-hidden' : ''}>
                  <input
                    key={c.name}
                    defaultValue={c.name}
                    aria-label={c.id}
                    onBlur={(e) =>
                      e.target.value.trim() &&
                      e.target.value !== c.name &&
                      updateArea(area.id, { categories: area.categories.map((x) => (x.id === c.id ? { ...x, name: e.target.value.trim() } : x)) })
                    }
                  />
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={c.hidden}
                      onChange={(e) => updateArea(area.id, { categories: area.categories.map((x) => (x.id === c.id ? { ...x, hidden: e.target.checked } : x)) })}
                    />
                    {t('settings.hidden')}
                  </label>
                </li>
              ))}
            </ul>
            <button className="btn" onClick={() => addCategory(area)}>
              + {t('settings.addCategory')}
            </button>
          </div>
        </details>
      ))}
      <button className="btn" onClick={addArea}>
        + {t('settings.addArea')}
      </button>
    </div>
  );
}
