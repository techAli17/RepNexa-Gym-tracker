import { copyFile, DocumentDirectoryPath, exists, unlink } from '@dr.pogodin/react-native-fs';
import ImagePicker from 'react-native-image-crop-picker';
import { DomainError } from '../../domain/errors';
import { rethrowStorageFull } from '../storageErrors';

const stripScheme = (p: string) => p.replace(/^file:\/\//, '');

export type PhotoSource = 'camera' | 'library';

export interface PhotoStore {
  /** Returns the saved file name, or null if the user cancelled. */
  capture(source: PhotoSource): Promise<string | null>;
  /** Image URI for a saved file name. */
  uri(fileName: string): string;
  exists(fileName: string): Promise<boolean>;
  remove(fileName: string | null): Promise<void>;
}

/**
 * Photos taken with the camera or picked from the library, cropped to a 16:9
 * banner and kept in the app's private documents folder. They stay on the
 * phone: they are not in backups or exports. Each store only ever touches its
 * own files, `<prefix>-<timestamp>.jpg`.
 */
function createPhotoStore(prefix: string, cropTitle: string): PhotoStore {
  const ownFile = new RegExp(`^${prefix}-\\d+\\.jpg$`);
  return {
    async capture(source) {
      const options = {
        mediaType: 'photo' as const,
        cropping: true,
        width: 1600,
        height: 900,
        compressImageQuality: 0.8,
        forceJpg: true,
        cropperToolbarTitle: cropTitle,
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
      const name = `${prefix}-${Date.now()}.jpg`;
      await copyFile(stripScheme(picked.path), `${DocumentDirectoryPath}/${name}`).catch(rethrowStorageFull);
      ImagePicker.cleanSingle(picked.path).catch(() => undefined);
      return name;
    },

    uri(fileName) {
      return `file://${DocumentDirectoryPath}/${fileName}`;
    },

    async exists(fileName) {
      return ownFile.test(fileName) && exists(`${DocumentDirectoryPath}/${fileName}`);
    },

    async remove(fileName) {
      if (!fileName || !ownFile.test(fileName)) return;
      await unlink(`${DocumentDirectoryPath}/${fileName}`).catch(() => undefined);
    },
  };
}

/** The gym photo shown on Home and in Settings → My gym. */
export const GymPhotoStore = createPhotoStore('gym', 'Frame your gym');

/** Your own photo of an exercise (your gym's machine, your setup), for any exercise. */
export const ExercisePhotoStore = createPhotoStore('exercise', 'Frame the exercise');
