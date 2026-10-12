/**
 * @jest-environment node
 */
import { builtInId } from '../../../data/exercises/builtInExercises';
import { BACKUP_SCHEMA_VERSION } from '../../../domain/backup/format';
import { BackupFormatError } from '../../../domain/backup/parse';
import { createTestServices, resetAllDatabases } from '../../../test/testServices';
import { CloudError, type AccountInfo, type CloudBackupStore, type RemoteFile } from '../../ports/cloud';

afterAll(() => resetAllDatabases());

const BENCH = builtInId('Bench Press');
const SQUAT = builtInId('Back Squat');
const DAY = 86_400_000;
const ACCOUNT: AccountInfo = { id: 'g-123', email: 'me@example.com', name: 'Me', photo: null, driveGranted: true };

type Ctx = Awaited<ReturnType<typeof createTestServices>>;

/** In-memory Drive: one file, a version counter, and hooks to inject faults. */
class FakeDrive implements CloudBackupStore {
  file: { id: string; content: string; version: number } | null = null;
  writes = 0;
  corruptNextEcho = false;
  beforeWrite?: () => void;

  private meta(): RemoteFile | null {
    return this.file ? { id: this.file.id, version: String(this.file.version), modifiedTime: '', size: this.file.content.length } : null;
  }
  async find() {
    return this.meta();
  }
  async metadata(id: string) {
    return this.file?.id === id ? this.meta() : null;
  }
  async read(f: RemoteFile) {
    if (!this.file || this.file.id !== f.id) throw new CloudError('notFound', 'gone', 404);
    if (this.corruptNextEcho && this.writes > 0) {
      this.corruptNextEcho = false;
      return this.file.content.slice(0, -5);
    }
    return this.file.content;
  }
  async write(content: string, existing: RemoteFile | null) {
    this.beforeWrite?.();
    this.writes++;
    if (existing && this.file?.id !== existing.id) throw new CloudError('notFound', 'gone', 404);
    this.file = { id: this.file?.id ?? `file-${this.writes}`, content, version: (this.file?.version ?? 0) + 1 };
    return this.meta()!;
  }
  /** Another device's upload. */
  replace(content: string) {
    this.file = { id: this.file?.id ?? 'file-x', content, version: (this.file?.version ?? 0) + 1 };
  }
}

async function logWorkout(ctx: Ctx, exercises: string[], weight: number, reps = 5) {
  const { services, clock } = ctx;
  let d = await services.workouts.startEmpty('kg');
  for (const id of exercises) d = await services.workouts.addExercise(d.workout.id, id, 'kg');
  for (const e of d.exercises) {
    for (const s of e.sets) {
      await services.workouts.updateSet(s.id, { weightValue: weight, reps });
      await services.workouts.setCompleted(s.id, true);
    }
  }
  clock.advance(3_600_000);
  await services.workouts.complete(d.workout.id);
  clock.advance(DAY);
  return d.workout.id;
}

const historyIds = async (ctx: Ctx) => (await ctx.services.history.list({ limit: 100 })).map(i => i.workout.id).sort();

describe('export and import', () => {
  it('round-trips everything into a fresh phone, rebuilding records', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH, SQUAT], 80);
    const deleted = await logWorkout(a, [BENCH], 85);
    await a.services.workouts.deleteCompleted(deleted);
    const custom = await a.services.exercises.createCustom({ name: 'Sled Push', muscleGroup: 'legs', equipment: 'other', trackingType: 'weight_reps' });
    await a.services.routines.create({ name: 'Mine', exercises: [{ exerciseId: custom.id, targetSets: 3, targetReps: 8, restSeconds: 90 }] });
    await a.services.settings.update({ weightUnit: 'lb' });

    const { json, fileName } = await a.services.backup.exportJson();
    expect(fileName).toMatch(/^RepNexa-Backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({ format: 'repnexa.backup', schemaVersion: BACKUP_SCHEMA_VERSION });
    expect(parsed.data.workouts.find((w: { id: string }) => w.id === deleted)).toMatchObject({ exercises: [] });

    const b = await createTestServices();
    const preview = await b.services.backup.previewImport(json);
    expect(preview.stats).toMatchObject({ workoutsAdded: 1, routinesChanged: 1 });
    await b.services.backup.applyImport(preview.file);

    expect(await historyIds(b)).toEqual(await historyIds(a));
    const [aw] = await a.services.history.list({ limit: 1 });
    const [bw] = await b.services.history.list({ limit: 1 });
    expect(bw.volumeKg).toBe(aw.volumeKg);
    expect((await b.services.routines.list())[0].exerciseNames).toEqual(['Sled Push']);
    expect((await b.repos.records.listForExercises([BENCH])).length).toBeGreaterThan(0);
    expect((await b.services.settings.load()).weightUnit).toBe('lb');
  });

  it('is idempotent: importing the same file twice changes nothing', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const { json } = await a.services.backup.exportJson();
    const b = await createTestServices();
    await b.services.backup.applyImport((await b.services.backup.previewImport(json)).file);
    const again = await b.services.backup.previewImport(json);
    expect(again.noChanges).toBe(true);
    const before = (await b.repos.backupState.get()).localRevision;
    await b.services.backup.applyImport(again.file);
    expect((await b.repos.backupState.get()).localRevision).toBe(before);
    expect(await b.services.history.list({ limit: 10 })).toHaveLength(1);
  });

  it('keeps newer local edits when importing an older file', async () => {
    const a = await createTestServices();
    const id = await logWorkout(a, [BENCH], 80);
    const { json: old } = await a.services.backup.exportJson();
    a.clock.advance(1000);
    await a.services.workouts.rename(id, 'Renamed later');
    const p = await a.services.backup.previewImport(old);
    expect(p.noChanges).toBe(true);
    expect(p.stats.keptLocal).toBeGreaterThan(0);
    expect((await a.services.workouts.getDetail(id))!.workout.name).toBe('Renamed later');
  });

  it('applies a newer deletion from another phone', async () => {
    const a = await createTestServices();
    const id = await logWorkout(a, [BENCH], 80);
    const b = await createTestServices();
    await b.services.backup.applyImport((await b.services.backup.previewImport((await a.services.backup.exportJson()).json)).file);
    a.clock.advance(5000);
    await a.services.workouts.deleteCompleted(id);
    const p = await b.services.backup.previewImport((await a.services.backup.exportJson()).json);
    expect(p.stats.workoutsDeleted).toBe(1);
    await b.services.backup.applyImport(p.file);
    expect(await b.services.history.list({ limit: 10 })).toEqual([]);
  });

  it.each([
    ['not json', '{oops', 'NOT_JSON'],
    ['another app', JSON.stringify({ format: 'other' }), 'NOT_A_BACKUP'],
    ['a newer schema', JSON.stringify({ format: 'repnexa.backup', schemaVersion: 99 }), 'TOO_NEW'],
    ['a damaged file', JSON.stringify({ format: 'repnexa.backup', schemaVersion: 1, data: {} }), 'INVALID'],
  ])('rejects %s with a clear reason', async (_label, text, problem) => {
    const { services } = await createTestServices();
    await expect(services.backup.previewImport(text)).rejects.toMatchObject({ details: expect.objectContaining({ problem }) });
  });

  it('rejects broken references and duplicate ids', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const file = JSON.parse((await a.services.backup.exportJson()).json);
    const broken = JSON.parse(JSON.stringify(file));
    broken.data.exercises = [];
    await expect(a.services.backup.previewImport(JSON.stringify(broken))).rejects.toBeInstanceOf(BackupFormatError);
    const dup = JSON.parse(JSON.stringify(file));
    dup.data.workouts.push(dup.data.workouts[0]);
    await expect(a.services.backup.previewImport(JSON.stringify(dup))).rejects.toMatchObject({
      details: expect.objectContaining({ problem: 'DUPLICATE_IDS' }),
    });
  });

  it('never overwrites the workout being logged', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const { json } = await a.services.backup.exportJson();
    const active = await a.services.workouts.startEmpty('kg');
    const forged = JSON.parse(json);
    forged.data.workouts[0].id = active.workout.id;
    forged.data.workouts[0].updatedAt = new Date(a.clock.now() + DAY).toISOString();
    await a.services.backup.applyImport((await a.services.backup.previewImport(JSON.stringify(forged))).file);
    expect((await a.services.workouts.getActiveDetail())!.workout.status).toBe('in_progress');
  });
});

describe('Drive sync', () => {
  it('creates, verifies, then reports up to date', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const drive = new FakeDrive();
    expect(await a.services.backup.sync(drive, ACCOUNT)).toMatchObject({ status: 'uploaded' });
    const st = await a.services.backup.status();
    expect(st).toMatchObject({ pending: false, accountId: ACCOUNT.id, remoteFileId: 'file-1', remoteVersion: '1' });
    expect(st.lastSuccessAt).not.toBeNull();
    expect(await a.services.backup.sync(drive, ACCOUNT)).toEqual({ status: 'upToDate' });
    expect(drive.writes).toBe(1);
    await logWorkout(a, [SQUAT], 100);
    expect((await a.services.backup.status()).pending).toBe(true);
    await a.services.backup.sync(drive, ACCOUNT);
    expect(drive.writes).toBe(2);
  });

  it('merges two phones through Drive in both directions', async () => {
    const drive = new FakeDrive();
    const a = await createTestServices();
    const b = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    await a.services.backup.sync(drive, ACCOUNT);
    await logWorkout(b, [SQUAT], 100);
    const out = await b.services.backup.sync(drive, ACCOUNT);
    expect(out).toMatchObject({ status: 'uploaded', remoteChanged: true });
    await a.services.backup.sync(drive, ACCOUNT);
    expect(await historyIds(a)).toEqual(await historyIds(b));
    expect(await historyIds(a)).toHaveLength(2);
  });

  it('does not record success when the upload does not verify', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const drive = new FakeDrive();
    drive.corruptNextEcho = true;
    await expect(a.services.backup.sync(drive, ACCOUNT)).rejects.toMatchObject({ kind: 'verify' });
    expect((await a.services.backup.status()).pending).toBe(true);
    expect(await a.services.backup.sync(drive, ACCOUNT)).toMatchObject({ status: 'uploaded' });
    expect((await a.services.backup.status()).pending).toBe(false);
  });

  it('refuses to overwrite a corrupt Drive file', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const drive = new FakeDrive();
    drive.replace('not a backup');
    await expect(a.services.backup.sync(drive, ACCOUNT)).rejects.toMatchObject({ kind: 'remoteInvalid' });
    expect(drive.file!.content).toBe('not a backup');
  });

  it('merges again when another device writes between download and upload', async () => {
    const drive = new FakeDrive();
    const a = await createTestServices();
    const b = await createTestServices();
    await logWorkout(b, [SQUAT], 100);
    await b.services.backup.sync(drive, ACCOUNT);
    await logWorkout(a, [BENCH], 80);
    const bFile = drive.file!.content;
    let interfered = false;
    // Just before A's metadata check, B uploads again.
    const meta = drive.metadata.bind(drive);
    drive.metadata = async (id: string) => {
      if (!interfered) {
        interfered = true;
        drive.replace(bFile);
      }
      return meta(id);
    };
    expect(await a.services.backup.sync(drive, ACCOUNT)).toMatchObject({ status: 'uploaded' });
    expect(await historyIds(a)).toHaveLength(2);
  });

  it('recreates the file when it was deleted from Drive', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const drive = new FakeDrive();
    await a.services.backup.sync(drive, ACCOUNT);
    drive.file = null;
    await logWorkout(a, [SQUAT], 90);
    expect(await a.services.backup.sync(drive, ACCOUNT)).toMatchObject({ status: 'uploaded' });
    expect(drive.file).not.toBeNull();
  });

  it('refuses another account’s data', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    const drive = new FakeDrive();
    await a.services.backup.sync(drive, ACCOUNT);
    await expect(a.services.backup.sync(drive, { ...ACCOUNT, id: 'g-other' })).rejects.toMatchObject({ kind: 'accountMismatch' });
  });
});

describe('local retention', () => {
  it('prunes only verified, old workouts; keeps them in Drive; never re-downloads them', async () => {
    const a = await createTestServices();
    const old = await logWorkout(a, [BENCH], 80);
    a.clock.advance(400 * DAY);
    const recent = await logWorkout(a, [BENCH], 85);
    await a.services.settings.update({ localRetentionMonths: 6 });

    const drive = new FakeDrive();
    const out = await a.services.backup.sync(drive, ACCOUNT);
    expect(out).toMatchObject({ status: 'uploaded', pruned: 1 });
    expect(await historyIds(a)).toEqual([recent]);
    expect(drive.file!.content).toContain(old);

    // Next round: the pruned workout stays in Drive and stays off the phone.
    await logWorkout(a, [SQUAT], 100);
    await a.services.backup.sync(drive, ACCOUNT);
    expect(drive.file!.content).toContain(old);
    expect(await historyIds(a)).not.toContain(old);
    // Records follow what is on the phone.
    const maxW = (await a.repos.records.listForExercises([BENCH])).find(r => r.recordType === 'max_weight')!;
    expect(maxW.value).toBe(85);
  });

  it('does nothing without a verified backup', async () => {
    const a = await createTestServices();
    await logWorkout(a, [BENCH], 80);
    a.clock.advance(400 * DAY);
    await a.services.settings.update({ localRetentionMonths: 6 });
    const drive = new FakeDrive();
    drive.corruptNextEcho = true;
    await expect(a.services.backup.sync(drive, ACCOUNT)).rejects.toBeInstanceOf(CloudError);
    expect(await historyIds(a)).toHaveLength(1);
  });

  it('keeps old workouts edited after the last verified snapshot', async () => {
    const a = await createTestServices();
    const old = await logWorkout(a, [BENCH], 80);
    a.clock.advance(400 * DAY);
    const drive = new FakeDrive();
    await a.services.backup.sync(drive, ACCOUNT);
    a.clock.advance(1000);
    await a.services.workouts.rename(old, 'Edited after backup');
    await a.services.settings.update({ localRetentionMonths: 6 });
    // Retention runs against the snapshot that was verified, which predates the edit.
    const st = await a.services.backup.status();
    expect(await a.services.backup.applyRetention(st.snapshotAt!)).toBe(0);
    expect(await historyIds(a)).toEqual([old]);
  });
});
