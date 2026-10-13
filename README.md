# RepNexa

A privacy-first gym workout tracker for Android and iOS. Workouts are logged offline into SQLite on the phone and can be backed up to the user's own Google Drive. There is no RepNexa server.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, data rules, backup design, limitations
- [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md): OAuth client IDs for sign-in and Drive
- [docs/EXERCISE_IMAGES.md](docs/EXERCISE_IMAGES.md): image licence review
- [docs/RELEASE.md](docs/RELEASE.md): signing, identifiers, store checklist

## Requirements

- Node 22.11 or newer
- Android: JDK 17, Android SDK (`ANDROID_HOME`)
- iOS: Xcode and CocoaPods

## Setup

```sh
npm install
npm approve-scripts better-sqlite3   # npm 11 blocks install scripts; tests need this native module
cd ios && pod install && cd ..
```

## Run

```sh
npm start
npm run android
npm run ios
```

## Check

```sh
npm test           # Jest: domain, SQLite integration (real schema), backup/sync, Drive client, components
npx tsc --noEmit
npm run lint
npm run e2e        # Maestro: app installed on a booted simulator/emulator, Metro running
```

End-to-end flows live in `.maestro/flows`: logging a workout, crash recovery, routines, custom exercises, offline backup screen, weekly plan, gym profile, editing a finished workout, switching to Hindi. They select elements by accessibility label, so a failing flow often means a screen-reader problem too. On a fresh iOS simulator, turn off the keyboard tip first, or it covers the screen:

```sh
xcrun simctl spawn <device-id> defaults write com.apple.keyboard.preferences DidShowContinuousPathIntroduction -bool true
```

## Features

- **Workout logging:**
  - start empty, from a routine or from a template; pause, resume, finish, discard
  - weight × reps, bodyweight, timed and distance sets; warm-up, drop and failure sets; RPE
  - previous-session values, rest timer per exercise, notes, replace an exercise with a suggested substitute
  - kg/lb without rounding loss
- **Crash recovery:** every edit is saved immediately and the active workout reopens after a crash.
- **History:** month grouping, date and exercise filters, workout detail with comparison to the previous session, editing finished workouts (including adding exercises), deleting, save as routine. Workouts kept only in Drive can be browsed read-only.
- **Routines:** create, edit, duplicate, reorder, delete; push/pull/legs, upper/lower and full-body templates.
- **Weekly plan:** choose the day your week starts, mark rest days, and set the exercises for each training day (missing exercises can be created on the spot). Home shows today's plan or a rest-day card.
- **My gym:** a name and a photo (camera or library, cropped to a banner) shown on Home. The photo stays on the phone.
- **Exercise library:** search, muscle-group filters, custom exercises (create, edit, delete), a front/back muscle map, similar exercises, your records per exercise.
- **Progress:** estimated 1-rep max trend, weekly volume and frequency, week streak, personal records, date ranges.
- **Backup and data:**
  - Google sign-in and Drive authorization as separate steps
  - automatic verified backups with conflict merging, restore from Drive
  - JSON export via the share sheet and import via the document picker, with a preview
  - where workouts are kept: on the phone and in Drive, or in Drive only (removed from the phone once a verified backup holds them)
  - local retention, per-account data isolation, delete data on this phone
- **Languages:** English and Hindi (हिन्दी); follows the phone or is chosen in Settings.
- **Robustness:** a full phone shows a plain message instead of failing silently; tested with 3,000 workouts / 60,000 sets.
- **Polish:** branded launch screen, loading skeletons, short animations that switch off with the OS "Reduce motion" setting.
