/** A backup file in the user's cloud storage. */
export interface RemoteFile {
  id: string;
  /** Changes on every write to the file (Drive's monotonically increasing `version`). */
  version: string;
  modifiedTime: string;
  size: number | null;
}

/** The user's own cloud storage, reduced to what backups need. Implemented over the Drive REST API. */
export interface CloudBackupStore {
  /** The backup file: by known id first, else by name. null when there is none. */
  find(knownId: string | null): Promise<RemoteFile | null>;
  metadata(id: string): Promise<RemoteFile | null>;
  read(file: RemoteFile): Promise<string>;
  /** Creates the file when `existing` is null, else uploads a new revision of it. */
  write(content: string, existing: RemoteFile | null): Promise<RemoteFile>;
}

export type CloudErrorKind =
  | 'notSignedIn'
  | 'auth' // token expired or revoked
  | 'scope' // Drive access not granted
  | 'notFound'
  | 'rateLimited'
  | 'quota' // the user's Drive is full
  | 'network'
  | 'timeout'
  | 'server'
  | 'conflict'
  | 'verify'
  | 'remoteInvalid'
  | 'accountMismatch'
  | 'notConfigured'
  | 'unknown';

const RETRYABLE: ReadonlySet<CloudErrorKind> = new Set(['rateLimited', 'network', 'timeout', 'server', 'conflict', 'verify']);

export class CloudError extends Error {
  readonly kind: CloudErrorKind;
  readonly status?: number;
  constructor(kind: CloudErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'CloudError';
    this.kind = kind;
    this.status = status;
  }
  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }
}

export const isCloudError = (e: unknown): e is CloudError => e instanceof CloudError;

export interface AccountInfo {
  /** Stable Google account id; used to keep each account's data in its own database. */
  id: string;
  email: string;
  name: string | null;
  photo: string | null;
  /** Whether Drive access (drive.file) has been granted. Signing in alone does not grant it. */
  driveGranted: boolean;
}

/**
 * Google sign-in and Drive authorization, kept as separate steps: a user can
 * sign in, and later choose whether to allow Drive access.
 */
export interface AuthGateway {
  isConfigured(): boolean;
  current(): Promise<AccountInfo | null>;
  signIn(): Promise<AccountInfo | null>;
  authorizeDrive(): Promise<boolean>;
  accessToken(): Promise<string>;
  /** Drops a token Drive rejected, so the next call fetches a fresh one. */
  invalidateToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  /** Revokes this app's access to the Google account entirely. */
  revoke(): Promise<void>;
}
