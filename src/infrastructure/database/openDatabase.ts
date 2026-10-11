import { open } from 'react-native-nitro-sqlite';
import { createSqlDatabase, type NitroLikeConnection, type SqlDatabase } from './SqlDatabase';

/**
 * One database file per owner. Before sign-in the owner is "local"; Phase 4
 * passes a key derived from the Google account so accounts never share data.
 */
export function openAppDatabase(ownerKey = 'local'): SqlDatabase {
  const safe = ownerKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'local';
  return createSqlDatabase(open({ name: `repnexa-${safe}.db` }) as unknown as NitroLikeConnection);
}
