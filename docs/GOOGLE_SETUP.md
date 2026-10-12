# Setting up Google sign-in and Drive backup

RepNexa backs up to the user's own Google Drive. This needs a Google Cloud project with OAuth clients. You create these once; there is still no server.

Until the IDs are set, the app runs fully offline and the Backup screen says that Drive backup is not set up. Export and import still work.

## 1. Google Cloud project

1. Create a project at <https://console.cloud.google.com/>.
2. **APIs & Services → Library**: enable **Google Drive API**.
3. **OAuth consent screen**: choose External, add the app name, support email and privacy policy URL.
   Add the scope `https://www.googleapis.com/auth/drive.file`. It is a non-sensitive scope, so Google's restricted-scope security assessment does not apply.
   While the consent screen is in **Testing**, only listed test users can sign in.

## 2. OAuth clients

Create three clients under **Credentials → Create credentials → OAuth client ID**:

| Type | Values | Used for |
| --- | --- | --- |
| Web application | none | `webClientId` (Android requests tokens with it) |
| Android | package `com.repnexa`, SHA-1 of each signing key (debug and release) | lets Android sign in |
| iOS | bundle ID from Xcode (`org.reactjs.native.example.RepNexa` until you change it) | `iosClientId` |

Debug SHA-1: `cd android && ./gradlew signingReport`. Add your Play upload key and the Play App Signing key's SHA-1 before release.

## 3. Put the IDs in the app

Edit [src/config/google.ts](../src/config/google.ts):

```ts
export const GOOGLE_CONFIG = {
  webClientId: '1234-abc.apps.googleusercontent.com',
  iosClientId: '1234-def.apps.googleusercontent.com',
};
```

These are public identifiers, not secrets. Never add a client secret or a service account to the app.

iOS also needs the reversed iOS client ID as a URL scheme. In `ios/RepNexa/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.1234-def</string>
    </array>
  </dict>
</array>
```

Then rebuild: `cd ios && pod install`, `npm run ios`, `npm run android`.

## How it behaves

- **Sign-in and Drive access are separate.** Signing in asks only for the basic profile. "Allow Drive backup" then asks for `drive.file`, which lets RepNexa see only files it created.
- **The backup file** is `RepNexa/RepNexa-Backup.json` in My Drive. It is visible, and the user can download, move or delete it.
- **Each Google account has its own database on the phone** (`repnexa-g_<id>.db`). Workouts logged before signing in can be copied into the account the first time.
- **When backups run:** about 8 seconds after a change, when the app returns to the foreground, and on "Back up now". Neither Android nor iOS guarantees background execution, so RepNexa does not rely on it. Changes made just before the app is closed upload the next time it opens; until then they are safe in SQLite.
- **Every upload is verified** by downloading it again and comparing it byte for byte. Only then does it count as a backup.
- **Conflicts:** if another device wrote the file since the last sync, RepNexa downloads it, merges it (newest version of each item wins, deletions travel as tombstones) and uploads the merge. A file that cannot be read is never overwritten automatically.

## What to test on a device

These paths cannot be covered by unit tests and need a real device with real accounts:

- Sign-in cancelled, Play services missing, offline sign-in.
- Revoking access at <https://myaccount.google.com/permissions>: the next backup should ask for Drive access again.
- Deleting the backup file in Drive: the next backup recreates it.
- Two phones on one account: logging on both, then syncing each.
- Switching accounts: each account sees only its own history.
