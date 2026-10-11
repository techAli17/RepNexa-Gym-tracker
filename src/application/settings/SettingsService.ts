import { DEFAULT_SETTINGS, type AppSettings } from '../../domain/models';
import type { Repositories } from '../ports/repositories';
import type { Clock } from '../ports/system';

const KEY = 'preferences';

export class SettingsService {
  constructor(private readonly d: { repos: Repositories; clock: Clock }) {}

  /** Unknown or missing keys fall back to defaults, so older stored settings keep working. */
  async load(): Promise<AppSettings> {
    const stored = (await this.d.repos.settings.get<Partial<AppSettings>>(KEY)) ?? {};
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.load()), ...patch };
    await this.d.repos.settings.set(KEY, next, this.d.clock.now());
    return next;
  }
}
