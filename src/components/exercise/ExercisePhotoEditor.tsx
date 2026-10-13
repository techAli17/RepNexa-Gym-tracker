import React, { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useT } from '../../i18n';
import { ExercisePhotoStore, type PhotoSource } from '../../infrastructure/photos/PhotoStore';
import { toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from '../common/AppText';
import { Button } from '../common/Button';
import { Icon, type IconName } from '../common/Icon';

/**
 * Your own photo of an exercise: a 16:9 banner with Take / Choose / Remove.
 * Capturing writes the file; `onChange` decides when it is saved and must
 * delete files it no longer needs.
 */
export function ExercisePhotoEditor({
  file,
  name,
  icon,
  onChange,
}: {
  file: string | null;
  name: string;
  icon: IconName;
  onChange: (file: string | null) => Promise<void> | void;
}) {
  const s = useStyles(styles);
  const { t } = useT();
  const [busy, setBusy] = useState<PhotoSource | null>(null);

  const pick = async (source: PhotoSource) => {
    if (busy) return;
    setBusy(source);
    try {
      const next = await ExercisePhotoStore.capture(source);
      if (next) await onChange(next);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    Alert.alert(t('exercises.photo.removeTitle'), t('exercises.photo.removeMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => Promise.resolve(onChange(null)).catch(toastError),
      },
    ]);

  return (
    <View>
      <View style={s.photo}>
        {file ? (
          <Image
            source={{ uri: ExercisePhotoStore.uri(file) }}
            style={s.image}
            resizeMode="cover"
            accessibilityLabel={t('exercises.photo.yourPhotoOf', { name: name || t('exercises.photo.thisExercise') })}
          />
        ) : (
          <View style={s.placeholder} accessibilityLabel={t('exercises.photo.none')}>
            <Icon name={icon} size={56} tint="ink3" strokeWidth={1.6} />
            <AppText variant="caption" color="ink3">
              {t('exercises.photo.addHint')}
            </AppText>
          </View>
        )}
      </View>
      <View style={s.pair}>
        <Button
          label={file ? t('exercises.photo.retake') : t('exercises.photo.take')}
          variant="outline"
          compact
          onPress={() => void pick('camera')}
          busy={busy === 'camera'}
          style={s.flex}
        />
        <Button
          label={file ? t('exercises.photo.change') : t('exercises.photo.choose')}
          variant="outline"
          compact
          onPress={() => void pick('library')}
          busy={busy === 'library'}
          style={s.flex}
        />
        {file ? <Button label={t('common.remove')} variant="dangerText" compact onPress={remove} /> : null}
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    photo: {
      borderRadius: 20,
      overflow: 'hidden',
      aspectRatio: 16 / 9,
      backgroundColor: t.colors.surface2,
    },
    image: { width: '100%', height: '100%' },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 20,
    },
    pair: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 16 },
  });
