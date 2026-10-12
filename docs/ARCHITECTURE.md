# RepNexa architecture

RepNexa is an offline-first gym tracker with no developer-owned backend. Workouts live in SQLite on the phone and, when the user turns it on, in one backup file in their own Google Drive.

## Layers

```
src/
  domain/          Pure TypeScript: models, calculations, Zod validation, backup format/parse/merge.
  application/     Use cases (Workout, Routine, Exercise, History, Analytics, Settings, Backup services),
                   BackupScheduler, ports (repositories, cloud, auth), composition root (container.ts).
  infrastructure/  SQLite adapter + migrations + repositories, Google auth gateway,
                   Drive REST client, file import/export, owner meta store.
  app/             App root, session per owner (account isolation), navigation.
  store/           Zustand stores for screen state only. They call services, never SQLite.
  features/        Screens, one folder per area.
  components/      Reusable UI: SetRow, NumberField, ExerciseBlock, RestTimerBar, charts, BackupStatus, …
  theme/ data/ hooks/ utils/ config/
```

Dependency direction: `features → store/app → application → domain`; `infrastructure` implements `application/ports`. Only `container.ts` and `app/session.ts` know which implementations exist.

## Data rules

| Rule | How it is enforced |
| --- | --- |
| Stable IDs across devices | Every row uses a UUID v4 primary key. Built-in exercises have fixed UUIDs. |
| Timestamps | SQLite: `INTEGER` epoch ms (UTC). Backup file: ISO 8601 with `Z`. |
| Lossless units | Sets store `weight_value` + `weight_unit` and `distance_value` + `distance_unit` as entered. |
| One active workout | Partial unique index plus a service check. |
| Atomic use cases | `UnitOfWork.run` binds every repository to one transaction. Code inside must use the transaction's repositories: the outer connection would deadlock. |
| Deletions reach other devices | Tombstones (`deleted_at`) for finished workouts, routines and custom exercises. |
| Pruning is not deleting | Workouts removed by retention are listed in `pruned_workouts`, so they stay in Drive and are not re-downloaded. |
| Derived analytics | `personal_records` is a cache rebuilt after every complete, edit, delete, import and prune. |
| Safe migrations | `PRAGMA user_version`, one transaction per migration; newer schemas are refused. |
| Crash safety | Every edit is committed before the UI updates; the active workout reloads at launch; `synchronous=FULL`. |
| No duplicate finish | `in_progress → completed` transition guard; the Finish button also guards re-entry. |

## Backup

**Format** (`domain/backup/format.ts`): `{ format: "repnexa.backup", schemaVersion: 1, exportedAt, appVersion, dataRevision, data }`. Workouts and routines are nested aggregates (exercises → sets inside), so references cannot dangle. `parseBackup` checks size, JSON, format, version (older versions are upgraded stepwise, newer ones refused), the Zod schema, unique IDs and references.

**Merge** (`domain/backup/merge.ts`): matched by UUID; the newer `updatedAt` wins; ties keep the local copy, so importing twice is a no-op. Items present on only one side are kept. The result is both the union to upload and the minimal set of aggregates to write locally. The active workout is never overwritten.

**Sync** (`BackupService.sync`):

1. Skip if nothing changed on either side.
2. Download and validate the Drive file. If it cannot be read, stop and never overwrite it.
3. Merge it into SQLite and take a snapshot, in one transaction.
4. Re-check the Drive version; if another device wrote meanwhile, start again (up to 3 times).
5. Upload the union.
6. Download again and compare byte for byte. Only now record success (`backed_up_revision`, remote id/version, snapshot time).
7. Apply local retention: remove only workouts that the verified snapshot holds unchanged.

**Scheduling** (`BackupScheduler`):

- Runs 8 seconds after the last committed change, when the app returns to the foreground, and on "Back up now".
- One sync at a time.
- Exponential backoff with jitter for network, server, rate-limit, conflict and verification errors, capped at 5 minutes and 6 attempts.
- Auth and scope errors stop retrying and ask the user to allow access again.
- No background execution is assumed on either OS.

**Accounts**: one SQLite file per owner (`repnexa-local.db`, `repnexa-g_<googleId>.db`); a small meta database remembers which one to open. Switching accounts disposes the whole session (database, stores, scheduler) and remounts navigation. On first sign-in, the user is offered to copy pre-sign-in workouts into the account; the local copy is kept.

**Auth** (`GoogleAuthGateway`): sign-in asks only for the basic profile; Drive access (`drive.file`) is a separate, later step. The Google SDK stores and refreshes tokens; RepNexa persists no credentials, so no Keychain is needed. A 401 response invalidates the cached token and retries once.

**Not guaranteed**: removing workouts from RepNexa cannot erase files the user exported, or iOS device backups (iCloud or computer). Android OS backup is disabled (`allowBackup="false"`). The app says so where retention and deletion are offered.

## Libraries

| Need | Choice | Why |
| --- | --- | --- |
| Storage | react-native-nitro-sqlite 10.1.0 | Real transactions; its Node mock runs the real schema in Jest |
| Navigation | React Navigation 7 (native stack, bottom tabs) | Native screens |
| State | Zustand 5 | Selector subscriptions keep set rows independent |
| Validation, forms | Zod 4, React Hook Form 7 + @hookform/resolvers | One schema for forms, services and backup files |
| Icons, charts | react-native-svg 15 with hand-built charts | Victory Native would add Skia, Reanimated and Gesture Handler for a few charts |
| Google | @react-native-google-signin/google-signin 16 | Sign-in, scopes and tokens |
| Drive | Plain `fetch` against the Drive v3 REST API | Small surface; no Google client SDK needed |
| Files | @react-native-documents/picker, @dr.pogodin/react-native-fs, react-native-share | System picker, cache file, share sheet |

Left out on purpose:

- **Notification libraries:** rest timers alert in-app only, by decision. This avoids Expo modules (this is a bare React Native app) and custom native code; Notifee has been unmaintained since December 2024.
- **Keychain:** no credentials are stored.
- **Reanimated:** motion is limited to native transitions for now.

## Known limitations

- **Google sign-in needs your OAuth client IDs.** See [GOOGLE_SETUP.md](GOOGLE_SETUP.md). Sign-in and Drive are tested against fakes, not against a live Google account.
- **No exercise images.** Their provenance is unverified; see [EXERCISE_IMAGES.md](EXERCISE_IMAGES.md).
- **Rest timer alerts only while the app is open (by decision).** The timer runs on an end timestamp, so coming back late shows the rest as over and vibrates at once.
- **No "drive only" storage mode.** Only the phone-plus-Drive policy exists; the type is ready for a strict cloud-only policy added later as an explicit choice.
- **Pruned workouts are viewable only after a restore.** Older workouts removed by retention are not viewable in the app until restored from Drive.
- **Finished workouts can't gain exercises.** Exercises cannot be added to a finished workout (sets, values, order, names and notes can be edited).
- **History PR badges count current records.** The badge shows records the workout still holds, so it can drop when a later workout beats one.
- **End-to-end coverage:** five Maestro flows pass on Release builds on the iOS 26.5 simulator and an Android emulator.
- **No on-device checks yet.** No performance profiling on real devices, and no full VoiceOver or TalkBack pass.
