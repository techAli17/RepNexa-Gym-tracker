import type { SqlDatabase } from './SqlDatabase';

/**
 * A tiny database outside any account's data: it only remembers whose data
 * to open at launch. Holds no workout data and no credentials.
 */
export interface MetaStore {
  getOwner(): Promise<string>;
  setOwner(owner: string): Promise<void>;
}

export const LOCAL_OWNER = 'local';
export const ownerForAccount = (googleAccountId: string) => `g_${googleAccountId}`;

export async function createMetaStore(db: SqlDatabase): Promise<MetaStore> {
  await db.run('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  return {
    async getOwner() {
      const rows = await db.query<{ value: string }>("SELECT value FROM kv WHERE key = 'owner'");
      return rows[0]?.value ?? LOCAL_OWNER;
    },
    async setOwner(owner) {
      await db.run("INSERT INTO kv (key, value) VALUES ('owner', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [owner]);
    },
  };
}
