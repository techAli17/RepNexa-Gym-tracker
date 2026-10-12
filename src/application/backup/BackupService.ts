import {
  BACKUP_FILE_NAME,
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  fromIso,
  toIso,
  type BackupData,
  type BackupPlan,
  type BackupFile,
} from '../../domain/backup/format';
import { isEmptyChange, mergeBackups, type MergeStats } from '../../domain/backup/merge';
import { BackupFormatError, parseBackup } from '../../domain/backup/parse';
import type { AppSettings, WeekPlanRecord, Weekday } from '../../domain/models';
import { CloudError, type AccountInfo, type CloudBackupStore, type RemoteFile } from '../ports/cloud';
import type { Repositories, SyncState, UnitOfWork } from '../ports/repositories';
import type { Clock } from '../ports/system';
import { rebuildRecords } from '../workouts/records';

export interface ImportPreview {
  file: BackupFile;
  stats: MergeStats;
  /** Nothing would change: every item is already here, or newer here. */
  noChanges: boolean;
}

export type SyncOutcome =
  | { status: 'upToDate' }
  | { status: 'uploaded'; stats: MergeStats | null; pruned: number; remoteChanged: boolean };

export interface BackupStatus extends SyncState {
  /** Local changes not yet in a verified backup. */
  pending: boolean;
}

const MAX_CONFLICT_RETRIES = 3;

const toBackupPlan = (p: WeekPlanRecord): BackupPlan => ({
  weekStart: p.weekStart,
  updatedAt: toIso(p.updatedAt),
  days: p.days.map(d => ({ weekday: d.weekday, routineId: d.routineId, isRest: d.isRest, updatedAt: toIso(d.updatedAt) })),
});

const fromBackupPlan = (p: BackupPlan): WeekPlanRecord => ({
  weekStart: p.weekStart as Weekday,
  updatedAt: fromIso(p.updatedAt),
  days: p.days.map(d => ({
    weekday: d.weekday as Weekday,
    routineId: d.routineId,
    isRest: d.isRest,
    updatedAt: fromIso(d.updatedAt),
  })),
});
const MONTH_MS = 30.44 * 86_400_000;

export class BackupService {
  constructor(
    private readonly d: {
      repos: Repositories;
      uow: UnitOfWork;
      clock: Clock;
      appVersion: string;
      /** Must read through the given repositories (they may be bound to a transaction). */
      loadSettings: (r: Repositories) => Promise<AppSettings>;
    },
  ) {}

  recordFailure(code: string, message: string): Promise<void> {
    return this.d.repos.backupData.recordFailure(code, message, this.d.clock.now());
  }

  async status(): Promise<BackupStatus> {
    const s = await this.d.repos.backupData.getSyncState();
    return { ...s, pending: s.localRevision > s.backedUpRevision };
  }

  /** Snapshot of this phone's data as a backup file. */
  async buildFile(r: Repositories = this.d.repos): Promise<{ file: BackupFile; revision: number }> {
    const data = await r.backupData.exportData();
    const prefs = await this.d.loadSettings(r);
    const revision = (await r.backupState.get()).localRevision;
    const plan = await r.plan.get();
    const preferences = {
      weightUnit: prefs.weightUnit,
      theme: prefs.theme,
      defaultRestSeconds: prefs.defaultRestSeconds,
      gymName: prefs.gymName,
    };
    return {
      file: this.wrap(
        {
          ...data,
          preferences,
          // An untouched default plan is left out, so it never overrides a real one elsewhere.
          plan: plan.updatedAt > 0 ? toBackupPlan(plan) : undefined,
        },
        revision,
      ),
      revision,
    };
  }

  private wrap(data: BackupData, revision: number): BackupFile {
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: toIso(this.d.clock.now()),
      appVersion: this.d.appVersion,
      dataRevision: revision,
      data,
    };
  }

  /** JSON for "Export", with a dated file name. */
  async exportJson(): Promise<{ json: string; fileName: string }> {
    const { file } = await this.buildFile();
    const day = new Date(this.d.clock.now()).toISOString().slice(0, 10);
    return { json: JSON.stringify(file, null, 1), fileName: BACKUP_FILE_NAME.replace('.json', `-${day}.json`) };
  }

  /** Validates a picked file and reports what importing it would do, without changing anything. */
  async previewImport(text: string): Promise<ImportPreview> {
    const file = parseBackup(text);
    const { file: local } = await this.buildFile();
    const pruned = await this.d.repos.backupData.prunedIds();
    const m = mergeBackups(local.data, file.data, pruned);
    return { file, stats: m.stats, noChanges: isEmptyChange(m.toApply) };
  }

  /**
   * Merges a validated backup into this phone in one transaction: newer items
   * win, nothing local is dropped, and a failure leaves the database untouched.
   */
  async applyImport(file: BackupFile): Promise<MergeStats> {
    return this.d.uow.run(async r => {
      const freshInstall = (await r.workouts.listCompleted({ limit: 1 })).length === 0;
      const stats = await this.mergeInto(r, file.data);
      // Preferences follow the data only onto a phone with no history of its own.
      if (freshInstall && Object.keys(file.data.preferences).length) {
        const current = await this.d.loadSettings(r);
        await r.settings.set('preferences', { ...current, ...file.data.preferences }, this.d.clock.now());
      }
      return stats;
    });
  }

  /** Merge inside a transaction, recomputing against fresh local data. */
  private async mergeInto(r: Repositories, incoming: BackupData): Promise<MergeStats> {
    const { file: local } = await this.buildFile(r);
    const pruned = await r.backupData.prunedIds();
    const m = mergeBackups(local.data, incoming, pruned);
    if (isEmptyChange(m.toApply)) return m.stats;
    const affected = await r.backupData.applyChanges(m.toApply);
    if (m.toApply.plan) await r.plan.replace(fromBackupPlan(m.toApply.plan));
    await rebuildRecords(r, affected, this.d.clock.now());
    await r.backupState.bumpLocalRevision();
    return m.stats;
  }

  /**
   * One backup round with the user's Drive:
   * 1. if the remote file exists, download and validate it, and merge it into
   *    this phone (another device may have written it);
   * 2. upload the merged snapshot, after checking nobody wrote in between;
   * 3. download it again and compare byte for byte before recording success;
   * 4. only then apply the local retention policy.
   * A corrupt remote file is never overwritten automatically.
   */
  async sync(cloud: CloudBackupStore, account: AccountInfo): Promise<SyncOutcome> {
    const state = await this.d.repos.backupData.getSyncState();
    if (state.accountId && state.accountId !== account.id) {
      throw new CloudError('accountMismatch', 'This phone’s data belongs to a different Google account.');
    }

    for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt++) {
      let remote = await cloud.find(state.remoteFileId);
      const remoteChanged = !!remote && remote.version !== state.remoteVersion;
      if (remote && !remoteChanged && state.localRevision === state.backedUpRevision && state.accountId === account.id) {
        return { status: 'upToDate' };
      }

      let remoteData: BackupData | null = null;
      if (remote) {
        try {
          remoteData = parseBackup(await cloud.read(remote)).data;
        } catch (e) {
          if (e instanceof BackupFormatError) {
            throw new CloudError('remoteInvalid', `The backup in your Drive could not be read: ${e.message}`);
          }
          throw e;
        }
      }

      // Merge and snapshot in one transaction, so edits made meanwhile are either fully in or wait for the next round.
      const snap = await this.d.uow.run(async r => {
        const stats = remoteData ? await this.mergeInto(r, remoteData) : null;
        const { file, revision } = await this.buildFile(r);
        const pruned = await r.backupData.prunedIds();
        // Upload the union, so workouts pruned from this phone stay in Drive.
        const data = remoteData ? mergeBackups(file.data, remoteData, pruned).merged : file.data;
        return { file: this.wrap(data, revision), revision, stats, at: this.d.clock.now() };
      });

      if (remote) {
        const latest = await cloud.metadata(remote.id);
        if (latest && latest.version !== remote.version) continue; // someone wrote meanwhile: merge again
        if (!latest) remote = null; // deleted meanwhile: create a new file
      }

      const content = JSON.stringify(snap.file);
      let written: RemoteFile;
      try {
        written = await cloud.write(content, remote);
      } catch (e) {
        if (e instanceof CloudError && e.kind === 'notFound') {
          await this.d.repos.backupData.clearRemote();
          written = await cloud.write(content, null);
        } else throw e;
      }

      const echo = await cloud.read(written);
      if (echo !== content) throw new CloudError('verify', 'The uploaded backup did not match. It will be retried.');

      await this.d.repos.backupData.recordSuccess({
        revision: snap.revision,
        at: this.d.clock.now(),
        snapshotAt: snap.at,
        accountId: account.id,
        remoteFileId: written.id,
        remoteVersion: written.version,
      });
      const pruned = await this.applyRetention(snap.at);
      return { status: 'uploaded', stats: snap.stats, pruned, remoteChanged };
    }
    throw new CloudError('conflict', 'Your backup kept changing while saving. It will be retried.');
  }

  /**
   * Removes old finished workouts from this phone, but only those the last
   * verified backup holds unchanged. Active workouts are never touched.
   * Note: this cannot erase copies in OS-level device backups or files the
   * user exported earlier.
   */
  async applyRetention(verifiedSnapshotAt: number): Promise<number> {
    const settings = await this.d.loadSettings(this.d.repos);
    if (settings.localRetentionMonths == null) return 0;
    const cutoff = this.d.clock.now() - settings.localRetentionMonths * MONTH_MS;
    return this.d.uow.run(async r => {
      const candidates = await r.backupData.pruneCandidates(cutoff, verifiedSnapshotAt);
      if (!candidates.length) return 0;
      const exerciseIds = new Set<string>();
      for (const c of candidates) for (const id of await r.workouts.exerciseIdsInWorkout(c.id)) exerciseIds.add(id);
      await r.backupData.prune(candidates, this.d.clock.now());
      await rebuildRecords(r, exerciseIds, this.d.clock.now());
      return candidates.length;
    });
  }

  /** Reads the Drive backup and reports what restoring it would change. */
  async previewRemote(cloud: CloudBackupStore): Promise<ImportPreview | null> {
    const state = await this.d.repos.backupData.getSyncState();
    const remote = await cloud.find(state.remoteFileId);
    if (!remote) return null;
    return this.previewImport(await cloud.read(remote));
  }
}
