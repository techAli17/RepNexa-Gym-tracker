import type { BackupSchedulerState } from '../../../application/backup/BackupScheduler';
import { ago, backupSentence } from '../BackupStatus';

const base: BackupSchedulerState = {
  phase: 'idle',
  account: null,
  pending: false,
  lastSuccessAt: null,
  error: null,
  nextAttemptAt: null,
  lastOutcome: null,
};
const now = 1_000_000_000;

it('formats relative times', () => {
  expect(ago(now - 10_000, now)).toBe('just now');
  expect(ago(now - 5 * 60_000, now)).toBe('5 min ago');
  expect(ago(now - 3 * 3_600_000, now)).toBe('3 h ago');
  expect(ago(now - 2 * 86_400_000, now)).toBe('2 d ago');
});

it('never claims a backup that did not happen', () => {
  expect(backupSentence({ ...base, phase: 'signedOut' }, now).text).toMatch(/this phone only/);
  expect(backupSentence({ ...base, phase: 'notConfigured' }, now).text).toMatch(/this phone only/);
  expect(backupSentence(base, now)).toEqual({ text: 'Not backed up yet', tone: 'warn' });
  expect(backupSentence({ ...base, pending: true, lastSuccessAt: now - 1000 }, now).tone).toBe('warn');
  expect(backupSentence({ ...base, lastSuccessAt: now - 120_000 }, now)).toEqual({
    text: 'Backed up to your Drive 2 min ago',
    tone: 'good',
  });
  expect(backupSentence({ ...base, phase: 'error', error: { kind: 'quota', message: 'Your Google Drive is full.' } }, now)).toEqual({
    text: 'Backup stopped: Your Google Drive is full.',
    tone: 'bad',
  });
});
