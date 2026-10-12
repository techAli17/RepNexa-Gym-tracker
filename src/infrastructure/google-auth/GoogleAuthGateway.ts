import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';
import { CloudError, type AccountInfo, type AuthGateway } from '../../application/ports/cloud';
import { GOOGLE_CONFIG } from '../../config/google';

/** The only Drive scope requested: access to files this app creates, nothing else. */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const toAccount = (u: User): AccountInfo => ({
  id: u.user.id,
  email: u.user.email,
  name: u.user.name,
  photo: u.user.photo,
  driveGranted: u.scopes.includes(DRIVE_FILE_SCOPE),
});

/**
 * Google sign-in (identity) and Drive authorization are separate steps:
 * `signIn` asks only for the basic profile; `authorizeDrive` adds drive.file
 * when the user turns on backup. Tokens stay inside the Google SDK, which
 * stores and refreshes them; RepNexa never persists a token itself.
 */
export class GoogleAuthGateway implements AuthGateway {
  private configured = false;

  isConfigured(): boolean {
    return Platform.OS === 'ios' ? !!GOOGLE_CONFIG.iosClientId : !!GOOGLE_CONFIG.webClientId;
  }

  private ensureConfigured() {
    if (!this.isConfigured()) throw new CloudError('notConfigured', 'Google sign-in is not set up in this build.');
    if (this.configured) return;
    GoogleSignin.configure({
      webClientId: GOOGLE_CONFIG.webClientId || undefined,
      iosClientId: GOOGLE_CONFIG.iosClientId || undefined,
      offlineAccess: false,
      scopes: [],
    });
    this.configured = true;
  }

  async current(): Promise<AccountInfo | null> {
    if (!this.isConfigured()) return null;
    this.ensureConfigured();
    const cached = GoogleSignin.getCurrentUser();
    if (cached) return toAccount(cached);
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    try {
      const r = await GoogleSignin.signInSilently();
      return r.type === 'success' ? toAccount(r.data) : null;
    } catch {
      return null; // offline or revoked: treated as signed out until the user acts
    }
  }

  async signIn(): Promise<AccountInfo | null> {
    this.ensureConfigured();
    try {
      if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const r = await GoogleSignin.signIn();
      return isSuccessResponse(r) ? toAccount(r.data) : null;
    } catch (e) {
      throw this.map(e);
    }
  }

  async authorizeDrive(): Promise<boolean> {
    this.ensureConfigured();
    try {
      const r = await GoogleSignin.addScopes({ scopes: [DRIVE_FILE_SCOPE] });
      if (r && isSuccessResponse(r)) return r.data.scopes.includes(DRIVE_FILE_SCOPE);
      return (await this.current())?.driveGranted ?? false;
    } catch (e) {
      if (isErrorWithCode(e) && /SCOPES_ALREADY_GRANTED/i.test(e.code)) return true;
      throw this.map(e);
    }
  }

  async accessToken(): Promise<string> {
    this.ensureConfigured();
    try {
      return (await GoogleSignin.getTokens()).accessToken;
    } catch (e) {
      throw this.map(e);
    }
  }

  async invalidateToken(token: string): Promise<void> {
    try {
      await GoogleSignin.clearCachedAccessToken(token);
    } catch {
      // Nothing cached; the next getTokens fetches a fresh one anyway.
    }
  }

  async signOut(): Promise<void> {
    if (!this.isConfigured()) return;
    this.ensureConfigured();
    await GoogleSignin.signOut();
  }

  async revoke(): Promise<void> {
    if (!this.isConfigured()) return;
    this.ensureConfigured();
    try {
      await GoogleSignin.revokeAccess();
    } finally {
      await GoogleSignin.signOut();
    }
  }

  private map(e: unknown): CloudError {
    if (e instanceof CloudError) return e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_REQUIRED) return new CloudError('notSignedIn', 'Sign in with Google to back up.');
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return new CloudError('notConfigured', 'Google Play services are missing or out of date on this phone.');
      }
      if (e.code === statusCodes.IN_PROGRESS) return new CloudError('unknown', 'Google sign-in is already open.');
      if (/DEVELOPER_ERROR|10\b/.test(String(e.code) + e.message)) {
        return new CloudError('notConfigured', 'Google sign-in is not set up correctly for this build.');
      }
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/network/i.test(msg)) return new CloudError('network', 'No connection to Google.');
    return new CloudError('unknown', msg || 'Google sign-in failed.');
  }
}
