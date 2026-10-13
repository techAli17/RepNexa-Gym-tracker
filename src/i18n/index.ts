import React, { createContext, useContext, useMemo } from 'react';
import type { DomainError } from '../domain/errors';
import type { LanguagePreference } from '../domain/models/settings';
import { en, type Dictionary } from './locales/en';
import { hi } from './locales/hi';
import type { LeafPaths, Plural, PluralPaths, Translation } from './types';

export type Language = 'en' | 'hi';
export type TKey = LeafPaths<Dictionary>;
export type TPluralKey = PluralPaths<Dictionary>;
export type Params = Record<string, string | number>;

const DICTIONARIES: Record<Language, Translation<Dictionary>> = { en, hi };

/** The phone's language, read through Intl (no native module needed). */
export function systemLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return locale.toLowerCase().startsWith('hi') ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export const resolveLanguage = (p: LanguagePreference | undefined): Language => (!p || p === 'system' ? systemLanguage() : p);

/**
 * The language in use. Module state so non-React code (toasts, formatters)
 * agrees with the screens; I18nProvider keeps it in step with the setting.
 */
let active: Language = systemLanguage();
export const activeLanguage = () => active;
export function setActiveLanguage(lang: Language) {
  active = lang;
}

/**
 * Locale for Intl date and number formatting. English keeps the phone's own
 * regional format (undefined), unless the phone itself is set to Hindi.
 */
export const intlLocale = (lang: Language = active): string | undefined =>
  lang === 'hi' ? 'hi-IN' : systemLanguage() === 'hi' ? 'en-IN' : undefined;

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict);
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Translated text for a key; falls back to English, then to the key itself. */
export function translate(lang: Language, key: TKey, params?: Params): string {
  const v = lookup(DICTIONARIES[lang], key) ?? lookup(en, key);
  return fill(typeof v === 'string' ? v : key, params);
}

/**
 * CLDR plural category, by hand: Hermes has no Intl.PluralRules.
 * English: "one" only for 1. Hindi: "one" for 0 and 1 (CLDR: i = 0 or n = 1).
 */
export function pluralCategory(lang: Language, count: number): 'one' | 'other' {
  if (lang === 'hi') return count === 0 || count === 1 ? 'one' : 'other';
  return count === 1 ? 'one' : 'other';
}

/** Plural form chosen by count; `{count}` is filled in automatically. */
export function translatePlural(lang: Language, key: TPluralKey, count: number, params?: Params): string {
  const p = (lookup(DICTIONARIES[lang], key) ?? lookup(en, key)) as Plural | undefined;
  if (!p) return key;
  const form = pluralCategory(lang, count) === 'one' ? p.one : p.other;
  return fill(form, { count, ...params });
}

/** For code outside React (toasts, alerts built in services callbacks). */
export const t = (key: TKey, params?: Params) => translate(active, key, params);
export const tn = (key: TPluralKey, count: number, params?: Params) => translatePlural(active, key, count, params);

const MESSAGE_KEYS = new Map(Object.entries(en.errors.messages).map(([k, v]) => [v, k as keyof Dictionary['errors']['messages']]));

/** A known English message (validation, services) in the active language; unknown text is returned as is. */
export function translateMessage(message: string, lang: Language = active): string {
  const known = MESSAGE_KEYS.get(message);
  return known ? DICTIONARIES[lang].errors.messages[known] : message;
}

/** A DomainError's message in the active language (services throw English). */
export function translateError(e: DomainError, lang: Language = active): string {
  if (lang === 'en') return e.message;
  const dict = DICTIONARIES[lang].errors;
  const known = MESSAGE_KEYS.get(e.message);
  if (known) return dict.messages[known];
  if (e.code === 'SET_INCOMPLETE' && Array.isArray(e.details?.missing)) {
    const fields = (e.details.missing as string[])
      .map(f => (dict.fields as Record<string, string>)[f] ?? f)
      .join(dict.and);
    return fill(e.message.startsWith('Enter') ? dict.enterFirst : dict.doneSetNeeds, { fields });
  }
  return dict.codes[e.code] ?? e.message;
}

interface I18nValue {
  lang: Language;
  t: (key: TKey, params?: Params) => string;
  tn: (key: TPluralKey, count: number, params?: Params) => string;
  locale: string | undefined;
}

const I18nContext = createContext<I18nValue | null>(null);

function makeValue(lang: Language): I18nValue {
  return {
    lang,
    t: (key, params) => translate(lang, key, params),
    tn: (key, count, params) => translatePlural(lang, key, count, params),
    locale: intlLocale(lang),
  };
}

export function I18nProvider({ preference, children }: { preference: LanguagePreference | undefined; children: React.ReactNode }) {
  const lang = resolveLanguage(preference);
  // Set during render so children rendering in this pass already format in the new language.
  setActiveLanguage(lang);
  const value = useMemo(() => makeValue(lang), [lang]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

/** Translation functions for the current language; re-renders when it changes. */
export function useT(): I18nValue {
  // Outside a provider (isolated component tests) use the active language.
  return useContext(I18nContext) ?? makeValue(active);
}
