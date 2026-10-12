import type { AccountInfo, AuthGateway, CloudBackupStore, CloudErrorKind } from '../ports/cloud';
import { isCloudError } from '../ports/cloud';
import type { BackupService, SyncOutcome } from './BackupService';

export type BackupPhase =
  | 'notConfigured' // no Google client IDs in this build
  | 'signedOut'
  | 'needsDrive' // signed in, Drive access not granted (or revoked)
  | 'off' // auto backup turned off
  | 'idle'
  | 'scheduled'
  | 'running'
  | 'retrying'
  | 'error';

export interface BackupSchedulerState {
  phase: BackupPhase;
  account: AccountInfo | null;
  pending: boolean;
  lastSuccessAt: number | null;
  error: { kind: CloudErrorKind; message: string } | null;
  nextAttemptAt: number | null;
  lastOutcome: SyncOutcome | null;
}

export interface SchedulerDeps {
  backup: BackupService;
  auth: AuthGateway;
  cloud: CloudBackupStore;
  autoBackupEnabled: () => boolean;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  random?: () => number;
  onState: (s: BackupSchedulerState) => void;
}

/** Wait after the last change before uploading, so a workout's edits go up together. */
export const DEBOUNCE_MS = 8_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const MAX_RETRIES = 6;

/**
 * Decides when to back up. Only while the app is running: neither Android nor
 * iOS guarantees background execution, so changes made just before the app is
 * closed are uploaded the next time it opens (they are safe in SQLite).
 */
export class BackupScheduler {
  private timer: unknown = null;
  private running: Promise<void> | null = null;
  private again = false;
  private attempts = 0;
  private state: BackupSchedulerState = {
    phase: 'idle',
    account: null,
    pending: false,
    lastSuccessAt: null,
    error: null,
    nextAttemptAt: null,
    lastOutcome: null,
  };

  constructor(private readonly d: SchedulerDeps) {}

  private now() {
    return (this.d.now ?? Date.now)();
  }
  private set(patch: Partial<BackupSchedulerState>) {
    this.state = { ...this.state, ...patch };
    this.d.onState(this.state);
  }
  getState() {
    return this.state;
  }

  /** Reads account and local status; schedules a backup if changes are waiting. */
  async refresh(): Promise<void> {
    const status = await this.d.backup.status();
    this.set({ pending: status.pending, lastSuccessAt: status.lastSuccessAt });
    if (!this.d.auth.isConfigured()) return this.set({ phase: 'notConfigured', account: null });
    const account = await this.d.auth.current();
    if (!account) return this.set({ phase: 'signedOut', account: null });
    if (!account.driveGranted) return this.set({ phase: 'needsDrive', account });
    if (!this.d.autoBackupEnabled()) return this.set({ phase: 'off', account });
    this.set({ account, phase: this.state.phase === 'error' || this.state.phase === 'retrying' ? this.state.phase : 'idle' });
    if (status.pending) this.schedule(2_000);
  }

  /** Called after every committed change. */
  notifyChange(): void {
    this.set({ pending: true });
    if (this.d.autoBackupEnabled() && this.state.account?.driveGranted) this.schedule(DEBOUNCE_MS);
  }

  private schedule(ms: number) {
    if (this.timer != null) (this.d.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.set({ phase: this.state.phase === 'retrying' ? 'retrying' : 'scheduled', nextAttemptAt: this.now() + ms });
    this.timer = (this.d.setTimer ?? setTimeout)(() => {
      this.timer = null;
      void this.run();
    }, ms);
  }

  /** "Back up now": ignores debounce and backoff. */
  async runNow(): Promise<SyncOutcome | null> {
    this.attempts = 0;
    if (this.timer != null) {
      (this.d.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
      this.timer = null;
    }
    await this.run();
    return this.state.lastOutcome;
  }

  /** One sync at a time; a request during a run triggers exactly one more run. */
  private run(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.doRun().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.run();
      }
    });
    return this.running;
  }

  private async doRun(): Promise<void> {
    const account = this.state.account ?? (await this.d.auth.current());
    if (!account) return this.set({ phase: 'signedOut', account: null });
    if (!account.driveGranted) return this.set({ phase: 'needsDrive', account });
    this.set({ phase: 'running', account, nextAttemptAt: null });
    try {
      const outcome = await this.d.backup.sync(this.d.cloud, account);
      this.attempts = 0;
      const status = await this.d.backup.status();
      this.set({ phase: 'idle', error: null, lastOutcome: outcome, pending: status.pending, lastSuccessAt: status.lastSuccessAt });
      if (status.pending && this.d.autoBackupEnabled()) this.schedule(DEBOUNCE_MS);
    } catch (e) {
      const kind: CloudErrorKind = isCloudError(e) ? e.kind : 'unknown';
      const message = e instanceof Error ? e.message : 'Backup failed.';
      await this.d.backup.recordFailure(kind, message).catch(() => undefined);
      if (kind === 'auth' || kind === 'scope' || kind === 'notSignedIn') {
        return this.set({ phase: 'needsDrive', error: { kind, message } });
      }
      if (isCloudError(e) && e.retryable && this.attempts < MAX_RETRIES) {
        this.attempts++;
        const delay = Math.min(MAX_BACKOFF_MS, 2_000 * 2 ** this.attempts) * (0.8 + 0.4 * (this.d.random ?? Math.random)());
        this.set({ phase: 'retrying', error: { kind, message } });
        this.schedule(Math.round(delay));
        return;
      }
      this.set({ phase: 'error', error: { kind, message } });
    }
  }

  stop(): void {
    if (this.timer != null) (this.d.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }
}
