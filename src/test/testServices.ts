import { open, resetAllDatabases } from 'react-native-nitro-sqlite/mock';
import { uuidv4 } from '../utils/uuid';
import { createAppServices, type AppServices } from '../application/container';
import { createRepositories } from '../infrastructure/database/repositories';
import { createSqlDatabase, type NitroLikeConnection, type SqlDatabase } from '../infrastructure/database/SqlDatabase';

/** Controllable clock for duration and ordering assertions. */
export class FakeClock {
  constructor(public t = Date.UTC(2026, 9, 5, 18, 0, 0)) {}
  now = () => this.t;
  advance(ms: number) {
    this.t += ms;
  }
}

let counter = 0;

/** Opens a real SQLite file (better-sqlite3 via the nitro mock) per test. */
export function openTestDb(name = `test-${++counter}-${uuidv4()}.db`): SqlDatabase {
  return createSqlDatabase(open({ name }) as unknown as NitroLikeConnection);
}

export async function createTestServices(name?: string) {
  const dbName = name ?? `test-${++counter}-${uuidv4()}.db`;
  const db = openTestDb(dbName);
  const clock = new FakeClock();
  const services: AppServices = await createAppServices(db, { clock });
  return { db, dbName, clock, services, repos: createRepositories(db) };
}

export { resetAllDatabases };
