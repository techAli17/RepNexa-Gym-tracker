import { DomainError } from '../domain/errors';

/** SQLite's SQLITE_FULL and the OS "no space" errors, as each layer words them. */
const FULL = /database or disk is full|SQLITE_FULL|disk I\/O error.*full|ENOSPC|No space left on device|not enough space|out of space/i;

export const STORAGE_FULL_MESSAGE =
  'Your phone is out of storage. Free up some space and try again. Everything saved before this is safe.';

export function isStorageFull(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message} ${String((e as { cause?: unknown }).cause ?? '')}` : String(e);
  return FULL.test(text);
}

/** Rethrows "disk full" failures as a clear, user-facing error; anything else unchanged. */
export function rethrowStorageFull(e: unknown): never {
  if (isStorageFull(e)) throw new DomainError('STORAGE_FULL', STORAGE_FULL_MESSAGE);
  throw e;
}
