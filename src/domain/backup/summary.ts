import { toKg } from '../calculations/units';
import type { BackupWorkout } from './format';
import { fromIso, fromIsoOrNull } from './format';

/** Totals for a workout read from a backup file (it is never written to the phone). */
export function summarizeBackupWorkout(w: BackupWorkout) {
  let volumeKg = 0;
  let sets = 0;
  for (const e of w.exercises) {
    for (const s of e.sets) {
      sets++;
      if (s.setType !== 'warmup' && s.weightValue != null && s.reps != null) {
        volumeKg += toKg(s.weightValue, s.weightUnit) * s.reps;
      }
    }
  }
  const started = fromIso(w.startedAt);
  const ended = fromIsoOrNull(w.endedAt) ?? started;
  return { volumeKg, sets, durationMs: Math.max(0, ended - started - w.pausedDurationMs), startedAt: started };
}
