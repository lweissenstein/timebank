import { useEffect, useRef, type ReactNode } from 'react';
import type { Area, Profile } from '../core/types';

export function Card({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** Modal dialog based on the native <dialog> element. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      {open && (
        <>
          <h2>{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'pos' | 'neg' | 'muted' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

export function tone(n: number): 'pos' | 'neg' | undefined {
  return n > 0.005 ? 'pos' : n < -0.005 ? 'neg' : undefined;
}

export function areaById(profile: Profile, id: string): Area | undefined {
  return profile.areas.find((a) => a.id === id);
}

export function labelFor(profile: Profile, areaId: string, categoryId: string): { area: string; category: string; color: string } {
  const area = areaById(profile, areaId);
  return {
    area: area?.name ?? areaId,
    category: area?.categories.find((c) => c.id === categoryId)?.name ?? categoryId,
    color: area?.color ?? '#888',
  };
}

/** "1:05:09" */
export function formatDuration(ms: number, withSeconds = true): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  return withSeconds ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${h}:${mm}`;
}

export function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens a file picker and resolves with the file's text. */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.click();
  });
}

/** URL-safe id from a name, unique within `taken`. */
export function slugId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

/** Whether the "relevant for thesis" flag is offered for sessions of this area. */
export function allowsThesisFlag(profile: Profile, areaId: string): boolean {
  return areaById(profile, areaId)?.thesisFlag !== false;
}
