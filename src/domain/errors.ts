export type DomainErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'ACTIVE_WORKOUT_EXISTS'
  | 'WORKOUT_NOT_ACTIVE'
  | 'NO_COMPLETED_SETS'
  | 'SET_INCOMPLETE'
  | 'DUPLICATE_NAME'
  | 'STORAGE_FULL';

/** Expected, user-recoverable failure. Anything else is a bug or an infrastructure fault. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export const isDomainError = (e: unknown, code?: DomainErrorCode): e is DomainError =>
  e instanceof DomainError && (code === undefined || e.code === code);
