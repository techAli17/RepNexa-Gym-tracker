/**
 * @jest-environment node
 */
import { CloudError, type AuthGateway } from '../../../application/ports/cloud';
import { DriveBackupStore } from '../DriveBackupStore';

type Call = { url: string; init: RequestInit };

function setup(responses: Array<(c: Call) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const r = responses[i++];
    if (!r) throw new Error(`unexpected request ${url}`);
    return r(call);
  }) as unknown as typeof fetch;
  const tokens = ['t1', 't2'];
  const auth: AuthGateway = {
    isConfigured: () => true,
    current: async () => null,
    signIn: async () => null,
    authorizeDrive: async () => true,
    accessToken: async () => tokens[0],
    invalidateToken: jest.fn(async () => {
      tokens.shift();
    }),
    signOut: async () => undefined,
    revoke: async () => undefined,
  };
  return { store: new DriveBackupStore(auth, { fetchImpl, timeoutMs: 1000 }), calls, auth };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const driveErr = (status: number, reason: string) => json(status, { error: { errors: [{ reason }], message: reason } });

describe('DriveBackupStore', () => {
  it('finds the backup by id, falling back to a marked-file search', async () => {
    const { store, calls } = setup([
      () => driveErr(404, 'notFound'),
      () => json(200, { files: [{ id: 'f9', version: '7', modifiedTime: 'x', size: '12' }] }),
    ]);
    expect(await store.find('gone')).toEqual({ id: 'f9', version: '7', modifiedTime: 'x', size: 12 });
    const search = decodeURIComponent(calls[1].url);
    expect(search).toContain("name = 'RepNexa-Backup.json'");
    expect(search).toContain("appProperties has { key='repnexaBackup' and value='1' }");
    expect(search).toContain('trashed = false');
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer t1' });
  });

  it('treats a trashed file as missing', async () => {
    const { store } = setup([() => json(200, { id: 'f1', version: '2', trashed: true })]);
    expect(await store.metadata('f1')).toBeNull();
  });

  it('creates the folder and file on first write, as a visible multipart upload', async () => {
    const { store, calls } = setup([
      () => json(200, { files: [] }),
      () => json(200, { id: 'folder1' }),
      () => json(200, { id: 'file1', version: '1' }),
    ]);
    const r = await store.write('{"a":1}', null);
    expect(r).toMatchObject({ id: 'file1', version: '1' });
    expect(calls[1].init.method).toBe('POST');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ name: 'RepNexa', mimeType: 'application/vnd.google-apps.folder' });
    const body = String(calls[2].init.body);
    expect(calls[2].url).toContain('uploadType=multipart');
    expect(body).toContain('"parents":["folder1"]');
    expect(body).toContain('"appProperties":{"repnexaBackup":"1"}');
    expect(body).toContain('{"a":1}');
  });

  it('updates an existing file with a media upload', async () => {
    const { store, calls } = setup([() => json(200, { id: 'file1', version: '5' })]);
    await store.write('{}', { id: 'file1', version: '4', modifiedTime: '', size: null });
    expect(calls[0].init.method).toBe('PATCH');
    expect(calls[0].url).toContain('/upload/drive/v3/files/file1?uploadType=media');
  });

  it('refreshes an expired token once', async () => {
    const { store, calls, auth } = setup([() => driveErr(401, 'authError'), () => new Response('content', { status: 200 })]);
    expect(await store.read({ id: 'f', version: '1', modifiedTime: '', size: null })).toBe('content');
    expect(auth.invalidateToken).toHaveBeenCalledWith('t1');
    expect(calls[1].init.headers).toMatchObject({ Authorization: 'Bearer t2' });
  });

  it.each([
    [401, 'authError', 'auth', false],
    [403, 'insufficientPermissions', 'scope', false],
    [403, 'storageQuotaExceeded', 'quota', false],
    [403, 'userRateLimitExceeded', 'rateLimited', true],
    [429, 'rateLimitExceeded', 'rateLimited', true],
    [500, 'backendError', 'server', true],
    [404, 'notFound', 'notFound', false],
  ])('maps HTTP %i %s to %s (retryable: %s)', async (status, reason, kind, retryable) => {
    const { store } = setup([() => driveErr(status, reason), () => driveErr(status, reason)]);
    const err = await store.read({ id: 'f', version: '1', modifiedTime: '', size: null }).catch(e => e);
    expect(err).toBeInstanceOf(CloudError);
    expect(err).toMatchObject({ kind, retryable });
  });

  it('reports network failures and timeouts as retryable', async () => {
    const offline = setup([() => Promise.reject(new TypeError('Network request failed'))]);
    await expect(offline.store.find(null)).rejects.toMatchObject({ kind: 'network', retryable: true });
    const slow = setup([
      c =>
        new Promise((_, reject) =>
          c.init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))),
        ),
    ]);
    await expect(slow.store.find(null)).rejects.toMatchObject({ kind: 'timeout', retryable: true });
  });
});
