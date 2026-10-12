import { copyFile, DocumentDirectoryPath, exists, unlink } from '@dr.pogodin/react-native-fs';
import ImagePicker from 'react-native-image-crop-picker';
import { DomainError } from '../../domain/errors';

const stripScheme = (p: string) => p.replace(/^file:\/\//, '');

/** Photo files the app owns: `gym-<timestamp>.jpg`. Anything else is never touched. */
const OWN_FILE = /^gym-\d+\.jpg$/;

/**
 * The gym photo, taken with the camera or picked from the library, cropped to a
 * 16:9 banner and kept in the app's private documents folder. It stays on the
 * phone: it is not in backups or exports.
 */
export const GymPhotoStore = {
  /** Returns the saved file name, or null if the user cancelled. */
  async capture(source: 'camera' | 'library'): Promise<string | null> {
    const options = {
      mediaType: 'photo' as const,
      cropping: true,
      width: 1600,
      height: 900,
      compressImageQuality: 0.8,
      forceJpg: true,
      cropperToolbarTitle: 'Frame your gym',
    };
    let picked;
    try {
      picked = source === 'camera' ? await ImagePicker.openCamera(options) : await ImagePicker.openPicker(options);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'E_PICKER_CANCELLED') return null;
      if (code === 'E_NO_CAMERA_PERMISSION') {
        throw new DomainError('VALIDATION', 'RepNexa needs camera access. Turn it on in your phone’s Settings.');
      }
      if (code === 'E_NO_LIBRARY_PERMISSION') {
        throw new DomainError('VALIDATION', 'RepNexa needs photo access. Turn it on in your phone’s Settings.');
      }
      if (code === 'E_PICKER_CANNOT_RUN_CAMERA_ON_SIMULATOR' || code === 'E_CAMERA_IS_NOT_AVAILABLE') {
        throw new DomainError('VALIDATION', 'No camera is available. Choose a photo from your library instead.');
      }
      throw e;
    }
    const name = `gym-${Date.now()}.jpg`;
    await copyFile(stripScheme(picked.path), `${DocumentDirectoryPath}/${name}`);
    ImagePicker.cleanSingle(picked.path).catch(() => undefined);
    return name;
  },

  /** Image URI for a saved file name. */
  uri(fileName: string): string {
    return `file://${DocumentDirectoryPath}/${fileName}`;
  },

  async exists(fileName: string): Promise<boolean> {
    return OWN_FILE.test(fileName) && exists(`${DocumentDirectoryPath}/${fileName}`);
  },

  async remove(fileName: string | null): Promise<void> {
    if (!fileName || !OWN_FILE.test(fileName)) return;
    await unlink(`${DocumentDirectoryPath}/${fileName}`).catch(() => undefined);
  },
};
