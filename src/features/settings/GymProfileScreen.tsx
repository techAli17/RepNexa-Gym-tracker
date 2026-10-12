import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Field, TextField } from '../../components/common/FormControls';
import { Icon } from '../../components/common/Icon';
import { GymPhotoStore } from '../../infrastructure/gym-photo/GymPhotoStore';
import { toast, toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

/** Your gym: a name and a photo, both kept only on this phone (the name is also in backups). */
export function GymProfileScreen({
  navigation,
}: RootScreenProps<'GymProfile'>) {
  const settings = useSettings(x => x.settings);
  const update = useSettings(x => x.update);
  const s = useStyles(styles);
  const [name, setName] = useState(settings.gymName ?? '');
  const [busy, setBusy] = useState<'camera' | 'library' | 'save' | null>(null);

  useEffect(() => setName(settings.gymName ?? ''), [settings.gymName]);

  const takePhoto = async (source: 'camera' | 'library') => {
    if (busy) return;
    setBusy(source);
    try {
      const file = await GymPhotoStore.capture(source);
      if (!file) return; // cancelled
      const previous = settings.gymPhotoFile;
      await update({ gymPhotoFile: file });
      await GymPhotoStore.remove(previous);
      toast('Gym photo saved');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = () =>
    Alert.alert('Remove the gym photo?', 'It is deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const previous = settings.gymPhotoFile;
          await update({ gymPhotoFile: null }).catch(toastError);
          await GymPhotoStore.remove(previous);
        },
      },
    ]);

  const save = async () => {
    setBusy('save');
    try {
      const trimmed = name.trim().slice(0, 60);
      await update({ gymName: trimmed || null });
      toast('Saved');
      navigation.goBack();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.body}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.photo}>
        {settings.gymPhotoFile ? (
          <Image
            source={{ uri: GymPhotoStore.uri(settings.gymPhotoFile) }}
            style={s.image}
            resizeMode="cover"
            accessibilityLabel={`Photo of ${settings.gymName ?? 'your gym'}`}
          />
        ) : (
          <View style={s.placeholder} accessibilityLabel="No gym photo yet">
            <Icon name="barbell" size={48} tint="ink3" strokeWidth={1.6} />
            <AppText variant="caption" color="ink3">
              Add a photo of your gym
            </AppText>
          </View>
        )}
      </View>

      <View style={s.pair}>
        <Button
          label="Take photo"
          variant="ink"
          onPress={() => void takePhoto('camera')}
          busy={busy === 'camera'}
          style={s.flex}
        />
        <Button
          label="Choose photo"
          variant="outline"
          onPress={() => void takePhoto('library')}
          busy={busy === 'library'}
          style={s.flex}
        />
      </View>
      {settings.gymPhotoFile ? (
        <Button
          label="Remove photo"
          variant="dangerText"
          onPress={removePhoto}
        />
      ) : null}

      <Field label="Gym name">
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="e.g. Iron Temple"
          maxLength={60}
          accessibilityLabel="Gym name"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
      </Field>
      <Button
        label="Save"
        variant="ink"
        onPress={() => void save()}
        busy={busy === 'save'}
      />
      <AppText variant="caption" color="ink3" style={s.note}>
        The photo stays on this phone only. It is not included in backups or
        exports. The name is.
      </AppText>
    </ScrollView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 48 },
    flex: { flex: 1 },
    photo: {
      borderRadius: 20,
      overflow: 'hidden',
      aspectRatio: 16 / 9,
      backgroundColor: t.colors.surface2,
      marginBottom: 14,
    },
    image: { width: '100%', height: '100%' },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 20,
    },
    pair: { flexDirection: 'row', gap: 8, marginBottom: 18 },
    note: { marginTop: 12 },
  });
