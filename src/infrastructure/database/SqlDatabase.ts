export type SqlValue = string | number | boolean | null | undefined;
export type SqlRow = Record<string, unknown>;

/** The minimum surface repositories need. Implemented by both a connection and a transaction. */
export interface SqlExecutor {
  query<R extends SqlRow = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<R[]>;
  run(sql: string, params?: readonly SqlValue[]): Promise<{ rowsAffected: number }>;
}

export interface SqlDatabase extends SqlExecutor {
  /**
   * Commits when `fn` resolves, rolls back when it throws. `fn` must only use
   * the `tx` executor: queueing on the outer connection from inside deadlocks.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): void;
  /** Closes the connection and deletes the database file. */
  destroy(): void;
}

/**
 * Structural subset of a react-native-nitro-sqlite connection (and its Node
 * mock). Declared here so the adapter does not depend on the native module.
 */
interface NitroResult {
  rowsAffected?: number;
  results?: unknown;
  rows?: { _array: unknown[] };
}
interface NitroExecutor {
  executeAsync(query: string, params?: SqlValue[]): Promise<NitroResult>;
}
export interface NitroLikeConnection extends NitroExecutor {
  transaction<T>(fn: (tx: NitroExecutor) => Promise<T>): Promise<T>;
  close(): void;
  delete(): void;
}

function wrapExecutor(ex: NitroExecutor): SqlExecutor {
  return {
    async query<R extends SqlRow>(sql: string, params?: readonly SqlValue[]) {
      const res = await ex.executeAsync(sql, params ? [...params] : undefined);
      return (res.rows?._array ?? (res.results as unknown[]) ?? []) as R[];
    },
    async run(sql: string, params?: readonly SqlValue[]) {
      const res = await ex.executeAsync(sql, params ? [...params] : undefined);
      return { rowsAffected: res.rowsAffected ?? 0 };
    },
  };
}

export function createSqlDatabase(conn: NitroLikeConnection): SqlDatabase {
  return {
    ...wrapExecutor(conn),
    transaction: fn => conn.transaction(tx => fn(wrapExecutor(tx))),
    close: () => conn.close(),
    destroy: () => conn.delete(),
  };
}

/**
 * Applied on every open; these PRAGMAs are per-connection, not stored in the file.
 * synchronous=FULL: logging writes are tiny, and a set logged just before a
 * power loss should survive it, not only an app kill.
 */
export async function configureConnection(db: SqlExecutor): Promise<void> {
  await db.query('PRAGMA foreign_keys = ON');
  await db.query('PRAGMA journal_mode = WAL');
  await db.query('PRAGMA synchronous = FULL');
  await db.query('PRAGMA busy_timeout = 3000');
}
