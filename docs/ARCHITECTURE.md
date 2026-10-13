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

## Weekly plan and gym profile

- **Plan** (`application/plan/PlanService.ts`, migration 003): `plan_settings` holds the week-start day; `plan_days` has one row per planned weekday, either a rest day or a link to a routine. A training day's exercises are a routine, so they reuse the routine editor, targets and reordering. Deleting a routine leaves its day "not planned" (`ON DELETE SET NULL`).
- **Gym profile**: the name and the photo's file name live in settings. The photo is cropped to 16:9 by react-native-image-crop-picker and copied into the app's private documents folder (`infrastructure/photos`). Only the file name is stored, because the iOS documents path changes between installs.
- **Backups**: the plan travels as an optional `plan` section (older files without it stay valid) and merges as one unit, newest wins. The gym name is a backed-up preference. The photo is not backed up or exported.

## Where workouts are kept

`AppSettings.storagePolicy`:

- `phone_and_drive` (default): finished workouts stay on the phone, optionally trimmed by `localRetentionMonths`.
- `drive_only`: after each verified backup, every finished workout the snapshot holds unchanged is removed from the phone. Choosing it requires a Drive connection and turns automatic backup on. The workout in progress always stays on the phone.

Removed workouts are recorded in `pruned_workouts`. History links to **Older workouts in your Drive**, which downloads the backup and lists the workouts the phone no longer has. The list is read-only and writes nothing locally (`BackupService.driveOnlyWorkouts`).

## Storage full

`infrastructure/storageErrors.ts` recognises "disk full" from SQLite (`SQLITE_FULL`) and the file system (`ENOSPC`, iOS/Android wording) and rethrows it as `DomainError('STORAGE_FULL')`. SQLite rolls the failed transaction back, so nothing half-written remains, and the user sees a plain message. Covered in `storageErrors.test.ts` by capping `max_page_count`.

## Large history

`application/__tests__/largeHistory.test.ts` imports 3,000 workouts (60,000 sets, more than three years of daily training) and times every screen query. On a laptop (better-sqlite3), the import takes about 3 s, history and analytics queries take 1–35 ms, and export takes under 1 s. Charts thin long series to 60 points, keeping each slice's best value so records stay visible (`downsample` in `ProgressChart.tsx`).

## Languages

`src/i18n`: `t('area.key', params)` and `tn()` for plurals, with dictionaries per area in `locales/en` and `locales/hi`. The Hindi files are typed against the English ones, so a missing key fails `tsc`, and a test checks that placeholders match. `AppSettings.language` is `system | en | hi`; `system` reads the phone's language through `Intl` (no native module). Services throw English `DomainError` messages; `translateError` maps them to Hindi by exact text, with a per-code fallback. Dates and numbers use `hi-IN` for Hindi and the phone's own locale for English. Exercise names, instructions and user data are not translated.

## Motion

Motion uses React Native's `Animated` and `LayoutAnimation` (no Reanimated): rows animate in and out of the active workout, the set check pops, toasts slide in, and loading skeletons pulse. `hooks/useReducedMotion.ts` follows the OS "Reduce motion" setting and turns all of it off.

## Launch screen

`scripts/generate-icons.mjs` draws the plate logo and writes the app icons and the launch logo (iOS `SplashLogo` image set, Android `drawable-*/splash_logo.png`). iOS uses `LaunchScreen.storyboard`. Android 12+ uses the system splash (`values-v31/styles.xml`); older versions use the window background (`drawable/launch_screen.xml`). The first JS frame continues the amber screen until the database is open.

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
| Gym photo | react-native-image-crop-picker 0.52 | Camera or library with cropping; actively maintained; no custom native code |

Left out on purpose:

- **Notification libraries:** rest timers alert in-app only, by decision. This avoids Expo modules (this is a bare React Native app) and custom native code; Notifee has been unmaintained since December 2024.
- **Keychain:** no credentials are stored.
- **Reanimated:** the few animations use `Animated` and `LayoutAnimation`.

## Known limitations

- **Google sign-in needs your OAuth client IDs.** See [GOOGLE_SETUP.md](GOOGLE_SETUP.md). Sign-in and Drive are tested against fakes, not against a live Google account.
- **No bundled exercise images.** Their provenance is unverified; see [EXERCISE_IMAGES.md](EXERCISE_IMAGES.md). Each exercise shows an original muscle map, and you can add your own photo.
- **Rest timer alerts only while the app is open (by decision).** The timer runs on an end timestamp, so coming back late shows the rest as over and vibrates at once.
- **Drive-only workouts are read-only.** They can be browsed online but not edited, and they don't count in Progress until restored.
- **Hindi covers the app's own text.** Exercise names and instructions stay in English.
- **History PR badges count current records.** The badge shows records the workout still holds, so it can drop when a later workout beats one.
- **End-to-end coverage:** nine Maestro flows, run on Release builds on the iOS 26.5 simulator and an Android emulator.
- **No on-device checks yet.** No performance profiling on real devices, and no full VoiceOver or TalkBack pass.
