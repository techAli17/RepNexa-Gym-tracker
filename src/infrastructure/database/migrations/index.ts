import type { SqlDatabase } from '../SqlDatabase';
import { migration001 } from './001_initial';
import { migration002 } from './002_backup';
import { migration003 } from './003_week_plan';
import { migration004 } from './004_exercise_photos';
import type { Migration } from './types';

export const MIGRATIONS: readonly Migration[] = [migration001, migration002, migration003, migration004];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export class SchemaTooNewError extends Error {
  constructor(readonly found: number, readonly supported: number) {
    super(`Database schema v${found} is newer than this app supports (v${supported}).`);
    this.name = 'SchemaTooNewError';
  }
}

export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const rows = await db.query<{ user_version: number }>('PRAGMA user_version');
  return Number(rows[0]?.user_version ?? 0);
}

/**
 * Applies pending migrations, each in its own transaction together with its
 * user_version bump, so a crash mid-migration leaves the previous version intact.
 * Refuses to open a database written by a newer app version rather than guess.
 */
export async function migrate(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<{ from: number; to: number }> {
  const from = await getSchemaVersion(db);
  const latest = migrations.length ? migrations[migrations.length - 1].version : 0;
  if (from > latest) throw new SchemaTooNewError(from, latest);

  let current = from;
  for (const m of migrations) {
    if (m.version <= current) continue;
    await db.transaction(async tx => {
      for (const sql of m.statements) await tx.run(sql);
      await tx.run(`PRAGMA user_version = ${Math.trunc(m.version)}`);
    });
    current = m.version;
  }
  const fk = await db.query('PRAGMA foreign_key_check');
  if (fk.length) throw new Error(`Foreign key violations after migration: ${fk.length}`);
  return { from, to: current };
}
