/**
 * OAuth client IDs from your Google Cloud project. They are public identifiers,
 * not secrets, so they may live in the app. There is no client secret and no
 * service account anywhere in RepNexa. See docs/GOOGLE_SETUP.md.
 *
 * Leave them empty to ship without Google features: the app works fully
 * offline and the Drive section explains that backup is not set up.
 */
export const GOOGLE_CONFIG = {
  /** "Web application" client ID. Android uses it to request tokens. */
  webClientId: '',
  /** "iOS" client ID. Its reversed form must also be a URL scheme in ios/RepNexa/Info.plist. */
  iosClientId: '',
};
