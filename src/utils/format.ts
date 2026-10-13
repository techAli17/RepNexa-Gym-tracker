import { convertWeight, roundForDisplay } from '../domain/calculations';
import type { WeightUnit } from '../domain/models';

import { activeLanguage, intlLocale, t } from '../i18n';

// Formatters are cached per language; the language can change while the app runs.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, make: (locale: string | undefined) => T): T {
  const k = `${activeLanguage()}|${key}`;
  let f = cache.get(k) as T | undefined;
  if (!f) {
    f = make(intlLocale());
    cache.set(k, f);
  }
  return f;
}
const nf1 = () => cached('n1', l => new Intl.NumberFormat(l, { maximumFractionDigits: 1 }));
const nf0 = () => cached('n0', l => new Intl.NumberFormat(l, { maximumFractionDigits: 0 }));

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? t('common.durationHM', { h, m }) : t('common.durationM', { m });
}

/** Weight in the viewer's unit, e.g. "102.5". */
export function formatWeight(value: number, from: WeightUnit, to: WeightUnit): string {
  return nf1().format(roundForDisplay(convertWeight(value, from, to), 1));
}

/** Volume in the viewer's unit; compact above 10k ("12.4K"). */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = convertWeight(kg, 'kg', unit);
  if (v >= 10000) {
    return cached('compact', l => new Intl.NumberFormat(l, { notation: 'compact', maximumFractionDigits: 1 })).format(v);
  }
  return nf0().format(Math.round(v));
}

export const formatDate = (ts: number, opts: Intl.DateTimeFormatOptions) =>
  cached(`d${JSON.stringify(opts)}`, l => new Intl.DateTimeFormat(l, opts)).format(ts);

/** Text for a numeric input: empty for null, no trailing zeros. */
export const inputText = (v: number | null): string => (v == null ? '' : String(roundForDisplay(v, 2)));
