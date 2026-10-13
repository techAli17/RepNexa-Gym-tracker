import { CachesDirectoryPath, readFile, unlink, writeFile } from '@dr.pogodin/react-native-fs';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import Share from 'react-native-share';
import { MAX_BACKUP_BYTES } from '../../domain/backup/format';
import { DomainError } from '../../domain/errors';
import { rethrowStorageFull } from '../storageErrors';

const stripScheme = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));

/**
 * Writes the JSON to the app cache and opens the system share sheet, so the
 * user chooses where it goes (Files, Drive, email…). The cache copy is
 * removed afterwards.
 */
export async function shareJsonFile(json: string, fileName: string): Promise<'shared' | 'dismissed'> {
  const path = `${CachesDirectoryPath}/${fileName}`;
  await writeFile(path, json, 'utf8').catch(rethrowStorageFull);
  try {
    const r = await Share.open({
      url: `file://${path}`,
      type: 'application/json',
      filename: fileName.replace(/\.json$/, ''),
      failOnCancel: false,
    });
    return r.dismissedAction ? 'dismissed' : 'shared';
  } finally {
    unlink(path).catch(() => undefined);
  }
}

/** Opens the system document picker for a JSON file and returns its text, or null if cancelled. */
export async function pickJsonFile(): Promise<string | null> {
  let picked;
  try {
    [picked] = await pick({ type: [types.json, types.plainText], mode: 'import' });
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
  if (picked.size != null && picked.size > MAX_BACKUP_BYTES) {
    throw new DomainError('VALIDATION', 'This file is too large to be a RepNexa backup.');
  }
  const [copy] = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: picked.name ?? 'backup.json' }],
    destination: 'cachesDirectory',
  });
  if (copy.status !== 'success') throw new DomainError('VALIDATION', 'The file could not be opened.');
  const path = stripScheme(copy.localUri);
  try {
    return await readFile(path, 'utf8');
  } finally {
    unlink(path).catch(() => undefined);
  }
}
