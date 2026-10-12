import { DomainError } from '../errors';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_BYTES,
  backupFileSchema,
  type BackupData,
  type BackupFile,
} from './format';

export type BackupProblem =
  | 'TOO_LARGE'
  | 'NOT_JSON'
  | 'NOT_A_BACKUP'
  | 'TOO_NEW'
  | 'INVALID'
  | 'BROKEN_REFERENCES'
  | 'DUPLICATE_IDS';

export class BackupFormatError extends DomainError {
  constructor(readonly problem: BackupProblem, message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, { problem, ...details });
    this.name = 'BackupFormatError';
  }
}

/**
 * Upgrades older backup files to the current shape, one version at a time.
 * Version 1 is the first, so there is nothing to upgrade yet; the hook exists
 * so a v2 app can still read v1 files.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

function migrateToCurrent(raw: Record<string, unknown>): Record<string, unknown> {
  let v = Number(raw.schemaVersion);
  let cur = raw;
  while (v < BACKUP_SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new BackupFormatError('INVALID', `Backup schema v${v} cannot be upgraded.`);
    cur = step(cur);
    v = Number(cur.schemaVersion);
  }
  return cur;
}

/** Ids must be unique and every reference must resolve inside the file. */
export function checkIntegrity(data: BackupData): void {
  if (data.plan) {
    const days = data.plan.days.map(d => d.weekday);
    if (new Set(days).size !== days.length) {
      throw new BackupFormatError('DUPLICATE_IDS', 'The weekly plan lists the same day twice.');
    }
  }
  const seen = new Set<string>();
  const dup = (id: string) => {
    if (seen.has(id)) throw new BackupFormatError('DUPLICATE_IDS', 'The backup contains the same item twice.', { id });
    seen.add(id);
  };
  const exercises = new Set<string>();
  for (const e of data.exercises) {
    dup(e.id);
    exercises.add(e.id);
  }
  const routines = new Set<string>();
  for (const r of data.routines) {
    dup(r.id);
    routines.add(r.id);
    for (const re of r.exercises) {
      dup(re.id);
      if (!exercises.has(re.exerciseId)) {
        throw new BackupFormatError('BROKEN_REFERENCES', 'A routine refers to an exercise that is not in the backup.', { id: re.id });
      }
    }
  }
  for (const w of data.workouts) {
    dup(w.id);
    if (w.deletedAt && w.exercises.length) {
      throw new BackupFormatError('INVALID', 'A deleted workout still has exercises.', { id: w.id });
    }
    if (!w.deletedAt && !w.endedAt) {
      throw new BackupFormatError('INVALID', 'A workout in the backup was never finished.', { id: w.id });
    }
    for (const we of w.exercises) {
      dup(we.id);
      if (!exercises.has(we.exerciseId)) {
        throw new BackupFormatError('BROKEN_REFERENCES', 'A workout refers to an exercise that is not in the backup.', { id: we.id });
      }
      for (const s of we.sets) {
        dup(s.id);
        if (s.distanceValue != null && s.distanceUnit == null) {
          throw new BackupFormatError('INVALID', 'A set has a distance without a unit.', { id: s.id });
        }
      }
    }
  }
}

/**
 * Turns untrusted text (a picked file, a Drive download) into a validated,
 * current-version backup, or throws a BackupFormatError that says what is wrong.
 */
export function parseBackup(text: string): BackupFile {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupFormatError('TOO_LARGE', 'This file is too large to be a RepNexa backup.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFormatError('NOT_JSON', 'This file is not valid JSON. It may be damaged or incomplete.');
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new BackupFormatError('NOT_A_BACKUP', 'This is not a RepNexa backup file.');
  }
  const version = Number((raw as { schemaVersion?: unknown }).schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new BackupFormatError('INVALID', 'The backup version is missing.');
  if (version > BACKUP_SCHEMA_VERSION) {
    throw new BackupFormatError('TOO_NEW', 'This backup was made by a newer version of RepNexa. Update the app to restore it.');
  }
  const r = backupFileSchema.safeParse(migrateToCurrent(raw as Record<string, unknown>));
  if (!r.success) {
    const first = r.error.issues[0];
    throw new BackupFormatError('INVALID', 'The backup file is damaged or was edited incorrectly.', {
      path: first?.path.join('.'),
      issue: first?.message,
    });
  }
  checkIntegrity(r.data.data);
  return r.data;
}
