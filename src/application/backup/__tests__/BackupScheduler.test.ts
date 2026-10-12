import { BackupScheduler, DEBOUNCE_MS, type BackupSchedulerState } from '../BackupScheduler';
import type { BackupService } from '../BackupService';
import { CloudError, type AccountInfo, type AuthGateway, type CloudBackupStore } from '../../ports/cloud';

const ACCOUNT: AccountInfo = { id: 'g1', email: 'a@b.c', name: null, photo: null, driveGranted: true };

function setup(opts: { sync?: jest.Mock; account?: AccountInfo | null; auto?: boolean } = {}) {
  let pending = true;
  const sync =
    opts.sync ??
    jest.fn(async () => {
      pending = false;
      return { status: 'uploaded' as const, stats: null, pruned: 0, remoteChanged: false };
    });
  const backup = {
    sync,
    status: jest.fn(async () => ({ pending, lastSuccessAt: pending ? null : 1 })),
    recordFailure: jest.fn(async () => undefined),
  } as unknown as BackupService;
  const auth = {
    isConfigured: () => true,
    current: jest.fn(async () => (opts.account === undefined ? ACCOUNT : opts.account)),
  } as unknown as AuthGateway;
  const states: BackupSchedulerState[] = [];
  const s = new BackupScheduler({
    backup,
    auth,
    cloud: {} as CloudBackupStore,
    autoBackupEnabled: () => opts.auto ?? true,
    random: () => 0.5,
    onState: st => states.push(st),
  });
  return { s, sync, backup, states, setPending: (p: boolean) => (pending = p) };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

it('debounces changes into one upload', async () => {
  const { s, sync } = setup();
  await s.refresh();
  s.notifyChange();
  s.notifyChange();
  s.notifyChange();
  await jest.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
  expect(sync).toHaveBeenCalledTimes(1);
  expect(s.getState()).toMatchObject({ phase: 'idle', pending: false });
});

it('retries retryable failures with growing delays, then succeeds', async () => {
  const sync = jest
    .fn()
    .mockRejectedValueOnce(new CloudError('network', 'offline'))
    .mockRejectedValueOnce(new CloudError('server', '500'))
    .mockImplementation(async () => {
      ctl.setPending(false);
      return { status: 'uploaded', stats: null, pruned: 0, remoteChanged: false };
    });
  const ctl = setup({ sync });
  const { s, backup } = ctl;
  await s.refresh();
  await s.runNow();
  expect(s.getState().phase).toBe('retrying');
  expect(backup.recordFailure).toHaveBeenCalledWith('network', 'offline');
  await jest.advanceTimersByTimeAsync(4_000); // 2s × 2^1
  expect(sync).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(7_000); // 2s × 2^2 = 8s, not yet
  expect(sync).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(2_000);
  expect(sync).toHaveBeenCalledTimes(3);
  expect(s.getState()).toMatchObject({ phase: 'idle', error: null });
});

it('stops and asks for access on auth problems', async () => {
  const sync = jest.fn().mockRejectedValue(new CloudError('scope', 'revoked'));
  const { s } = setup({ sync });
  await s.refresh();
  await s.runNow();
  expect(s.getState()).toMatchObject({ phase: 'needsDrive', error: { kind: 'scope' } });
  await jest.advanceTimersByTimeAsync(10 * 60_000);
  expect(sync).toHaveBeenCalledTimes(1);
});

it('does not retry permanent failures', async () => {
  const sync = jest.fn().mockRejectedValue(new CloudError('remoteInvalid', 'bad file'));
  const { s } = setup({ sync });
  await s.refresh();
  await s.runNow();
  expect(s.getState().phase).toBe('error');
  await jest.advanceTimersByTimeAsync(10 * 60_000);
  expect(sync).toHaveBeenCalledTimes(1);
});

it('runs one sync at a time and queues exactly one follow-up', async () => {
  let release!: () => void;
  const sync = jest.fn(
    () =>
      new Promise(r => {
        release = () => r({ status: 'upToDate' });
      }),
  );
  const { s } = setup({ sync: sync as unknown as jest.Mock });
  await s.refresh();
  const a = s.runNow();
  const b = s.runNow();
  const c = s.runNow();
  await flush();
  expect(sync).toHaveBeenCalledTimes(1);
  release();
  await a;
  await flush();
  release();
  await Promise.all([b, c]);
  await flush();
  expect(sync).toHaveBeenCalledTimes(2);
});

it('reports signed-out and Drive-not-granted states without syncing', async () => {
  const out = setup({ account: null });
  await out.s.refresh();
  expect(out.s.getState().phase).toBe('signedOut');
  const noDrive = setup({ account: { ...ACCOUNT, driveGranted: false } });
  await noDrive.s.refresh();
  expect(noDrive.s.getState().phase).toBe('needsDrive');
  expect(noDrive.sync).not.toHaveBeenCalled();
});

it('respects auto backup being off, but still backs up on request', async () => {
  const { s, sync } = setup({ auto: false });
  await s.refresh();
  expect(s.getState().phase).toBe('off');
  s.notifyChange();
  await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
  expect(sync).not.toHaveBeenCalled();
  await s.runNow();
  expect(sync).toHaveBeenCalledTimes(1);
});
