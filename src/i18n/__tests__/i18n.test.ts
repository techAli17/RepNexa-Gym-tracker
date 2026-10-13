import { DomainError } from '../../domain/errors';
import { STORAGE_FULL_MESSAGE } from '../../infrastructure/storageErrors';
import { formatDuration } from '../../utils/format';
import { setActiveLanguage, translate, translateError, translatePlural } from '../index';
import { weekdayName } from '../labels';
import { en } from '../locales/en';
import { hi } from '../locales/hi';

afterEach(() => setActiveLanguage('en'));

function leaves(o: unknown, path = ''): Array<[string, string]> {
  if (typeof o === 'string') return [[path, o]];
  return Object.entries(o as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

describe('dictionaries', () => {
  it('has a non-empty Hindi string for every English one', () => {
    const hiMap = new Map(leaves(hi));
    const missing = leaves(en).filter(([k]) => !hiMap.get(k)?.trim());
    expect(missing).toEqual([]);
  });

  it('keeps every {placeholder} in the Hindi text', () => {
    const hiMap = new Map(leaves(hi));
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    const broken = leaves(en).filter(([k, v]) => ph(v) !== ph(hiMap.get(k) ?? ''));
    expect(broken).toEqual([]);
  });
});

describe('translate', () => {
  it('fills parameters and switches language', () => {
    expect(translate('en', 'common.durationHM', { h: 1, m: 5 })).toBe('1 h 5 min');
    expect(translate('hi', 'common.durationHM', { h: 1, m: 5 })).toBe('1 घं 5 मिनट');
  });

  it('drives shared formatters and labels through the active language', () => {
    setActiveLanguage('hi');
    expect(formatDuration(65 * 60_000)).toBe('1 घं 5 मिनट');
    expect(weekdayName(1)).toBe('सोमवार');
    setActiveLanguage('en');
    expect(weekdayName(1)).toBe('Monday');
  });
});

describe('translateError', () => {
  it('leaves English messages untouched', () => {
    expect(translateError(new DomainError('VALIDATION', 'Pick a day of the week'), 'en')).toBe('Pick a day of the week');
  });

  it('translates known service messages', () => {
    expect(translateError(new DomainError('STORAGE_FULL', STORAGE_FULL_MESSAGE), 'hi')).toBe(hi.errors.messages.storageFull);
  });

  it('builds the missing-fields message in Hindi', () => {
    const e = new DomainError('SET_INCOMPLETE', 'Enter weight and reps first', { missing: ['weight', 'reps'] });
    expect(translateError(e, 'hi')).toBe('पहले वज़न और रेप्स भरें');
  });

  it('falls back to a message for the error code', () => {
    expect(translateError(new DomainError('NOT_FOUND', 'Plate not found'), 'hi')).toBe(hi.errors.codes.NOT_FOUND);
  });
});

describe('translatePlural', () => {
  // Hermes ships without Intl.PluralRules; plurals must not depend on it.
  const original = Intl.PluralRules;
  beforeAll(() => {
    (Intl as { PluralRules?: unknown }).PluralRules = undefined;
  });
  afterAll(() => {
    (Intl as { PluralRules?: unknown }).PluralRules = original;
  });

  it('picks the form without Intl.PluralRules', () => {
    expect(translatePlural('en', 'history.workoutCount', 1)).toBe(en.history.workoutCount.one.replace('{count}', '1'));
    expect(translatePlural('en', 'history.workoutCount', 3)).toBe(en.history.workoutCount.other.replace('{count}', '3'));
    expect(translatePlural('hi', 'history.workoutCount', 0)).toBe(hi.history.workoutCount.one.replace('{count}', '0'));
    expect(translatePlural('hi', 'history.workoutCount', 2)).toBe(hi.history.workoutCount.other.replace('{count}', '2'));
  });
});
