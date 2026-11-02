import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { parseISODate, type ISODate } from '../core/dates';
import { de } from './de';
import { en, type MessageKey } from './en';

export type Lang = 'en' | 'de';

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, de };
const LANG_KEY = 'timebank.lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'de') return stored;
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('de') ? 'de' : 'en';
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Hours with one or two decimals, e.g. "12.5". */
  num: (n: number, digits?: number) => string;
  /** Signed hours, e.g. "+12.5 h". */
  signed: (n: number) => string;
  /** Short date like "Mon, 09.11." */
  date: (d: ISODate, opts?: Intl.DateTimeFormatOptions) => string;
  time: (ms: number) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const locale = lang === 'de' ? 'de-DE' : 'en-GB';
    const nf = (digits: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits });
    const t: I18n['t'] = (key, vars) => {
      let s = MESSAGES[lang][key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    };
    const num = (n: number, digits = 1) => nf(digits).format(Math.abs(n) < 0.005 ? 0 : n);
    return {
      lang,
      setLang,
      t,
      num,
      signed: (n) => `${n > 0.005 ? '+' : n < -0.005 ? '−' : '±'}${num(Math.abs(n))} h`,
      date: (d, opts = { weekday: 'short', day: '2-digit', month: '2-digit' }) =>
        new Intl.DateTimeFormat(locale, opts).format(parseISODate(d)),
      time: (ms) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ms)),
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n outside of I18nProvider');
  return ctx;
}
