import { BACKUP_FILE_NAME } from '../../domain/backup/format';
import { CloudError, type AuthGateway, type CloudBackupStore, type RemoteFile } from '../../application/ports/cloud';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FIELDS = 'id,name,version,modifiedTime,size,trashed';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** Marks files this app created, so a stray file with the same name is never mistaken for the backup. */
const APP_PROPERTY = 'repnexaBackup';

interface DriveFile {
  id: string;
  version?: string;
  modifiedTime?: string;
  size?: string;
  trashed?: boolean;
}

const toRemote = (f: DriveFile): RemoteFile => ({
  id: f.id,
  version: String(f.version ?? '0'),
  modifiedTime: f.modifiedTime ?? '',
  size: f.size != null ? Number(f.size) : null,
});

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/**
 * The backup as a normal, user-visible file (`RepNexa/RepNexa-Backup.json`) in
 * the user's own Drive, via the REST API with the `drive.file` scope: the app
 * can see only files it created, nothing else in the user's Drive.
 */
export class DriveBackupStore implements CloudBackupStore {
  constructor(
    private readonly auth: AuthGateway,
    private readonly opts: { timeoutMs?: number; folderName?: string; fetchImpl?: typeof fetch } = {},
  ) {}

  private get fetch() {
    return this.opts.fetchImpl ?? fetch;
  }

  /** Authorized request with a timeout. A 401 drops the cached token and retries once. */
  private async request(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const token = await this.auth.accessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 30_000);
    let res: Response;
    try {
      res = await this.fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') throw new CloudError('timeout', 'Drive did not respond in time.');
      throw new CloudError('network', 'No connection to Google Drive.');
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return res;
    if (res.status === 401 && !retried) {
      await this.auth.invalidateToken(token);
      return this.request(url, init, true);
    }
    throw await this.toError(res);
  }

  private async toError(res: Response): Promise<CloudError> {
    let reason = '';
    let message = '';
    try {
      const body = await res.json();
      reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '';
      message = body?.error?.message ?? '';
    } catch {
      // Non-JSON error body; the status code is enough.
    }
    const s = res.status;
    if (s === 401) return new CloudError('auth', 'Your Google sign-in expired. Sign in again to back up.', s);
    if (s === 403 && /insufficient(Permissions|Scopes)|PERMISSION_DENIED/i.test(reason)) {
      return new CloudError('scope', 'RepNexa no longer has access to your Drive. Allow access to resume backups.', s);
    }
    if (s === 403 && /storageQuotaExceeded/i.test(reason)) return new CloudError('quota', 'Your Google Drive is full.', s);
    if (s === 429 || (s === 403 && /rateLimit|userRateLimit/i.test(reason))) {
      return new CloudError('rateLimited', 'Google Drive is busy. Retrying shortly.', s);
    }
    if (s === 404) return new CloudError('notFound', 'The backup file is no longer in your Drive.', s);
    if (s >= 500) return new CloudError('server', 'Google Drive had a problem. Retrying shortly.', s);
    return new CloudError('unknown', message || `Drive request failed (${s}).`, s);
  }

  async metadata(id: string): Promise<RemoteFile | null> {
    try {
      const res = await this.request(`${API}/files/${encodeURIComponent(id)}?fields=${FIELDS}`);
      const f = (await res.json()) as DriveFile;
      return f.trashed ? null : toRemote(f);
    } catch (e) {
      if (e instanceof CloudError && e.kind === 'notFound') return null;
      throw e;
    }
  }

  async find(knownId: string | null): Promise<RemoteFile | null> {
    if (knownId) {
      const byId = await this.metadata(knownId);
      if (byId) return byId;
    }
    const query = [
      `name = '${q(BACKUP_FILE_NAME)}'`,
      'trashed = false',
      `appProperties has { key='${APP_PROPERTY}' and value='1' }`,
    ].join(' and ');
    const res = await this.request(
      `${API}/files?spaces=drive&orderBy=modifiedTime desc&pageSize=1&fields=files(${FIELDS})&q=${encodeURIComponent(query)}`,
    );
    const body = (await res.json()) as { files?: DriveFile[] };
    return body.files?.[0] ? toRemote(body.files[0]) : null;
  }

  async read(file: RemoteFile): Promise<string> {
    const res = await this.request(`${API}/files/${encodeURIComponent(file.id)}?alt=media`);
    return res.text();
  }

  async write(content: string, existing: RemoteFile | null): Promise<RemoteFile> {
    if (existing) {
      // A media upload replaces the content atomically: Drive keeps either the old or the new revision.
      const res = await this.request(`${UPLOAD}/files/${encodeURIComponent(existing.id)}?uploadType=media&fields=${FIELDS}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: content,
      });
      return toRemote((await res.json()) as DriveFile);
    }
    const folderId = await this.ensureFolder();
    const boundary = `repnexa-${Date.now().toString(36)}`;
    const meta = {
      name: BACKUP_FILE_NAME,
      mimeType: 'application/json',
      parents: [folderId],
      appProperties: { [APP_PROPERTY]: '1' },
      description: 'RepNexa workout backup. Keep this file to restore your training history.',
    };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return toRemote((await res.json()) as DriveFile);
  }

  /** The visible "RepNexa" folder in My Drive, created on first backup. */
  private async ensureFolder(): Promise<string> {
    const name = this.opts.folderName ?? 'RepNexa';
    const query = `mimeType = '${FOLDER_MIME}' and name = '${q(name)}' and trashed = false and 'root' in parents`;
    const res = await this.request(`${API}/files?spaces=drive&pageSize=1&fields=files(id)&q=${encodeURIComponent(query)}`);
    const found = (await res.json()) as { files?: Array<{ id: string }> };
    if (found.files?.[0]) return found.files[0].id;
    const created = await this.request(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
    });
    return ((await created.json()) as { id: string }).id;
  }
}
