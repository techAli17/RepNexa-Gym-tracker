import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useActiveWorkoutStore, useServices } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { Button } from '../../components/common/Button';
import { iconForEquipment } from '../../components/common/Icon';
import { ExercisePhotoEditor } from '../../components/exercise/ExercisePhotoEditor';
import { ChoiceChips, Field, TextField } from '../../components/common/FormControls';
import { isDomainError } from '../../domain/errors';
import { EQUIPMENT, MUSCLE_GROUPS, TRACKING_TYPES } from '../../domain/models';
import { customExerciseSchema } from '../../domain/validation';
import { translateError, translateMessage, useT } from '../../i18n';
import { equipmentLabel, muscleGroupLabel, trackingTypeLabel } from '../../i18n/labels';
import { ExercisePhotoStore } from '../../infrastructure/photos/PhotoStore';
import { toast, toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

type FormIn = z.input<typeof customExerciseSchema>;
type FormOut = z.output<typeof customExerciseSchema>;

/** Create or edit a custom exercise. Opened from the picker, the new exercise is applied to that flow. */
export function ExerciseFormScreen({ navigation, route }: RootScreenProps<'ExerciseForm'>) {
  const { id, pickFor } = route.params ?? {};
  const services = useServices();
  const store = useActiveWorkoutStore();
  const s = useStyles(styles);
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  // The photo is only saved with the form; `saved` is what the database holds.
  const [photo, setPhotoState] = useState<string | null>(null);
  const photoRef = useRef({ current: null as string | null, saved: null as string | null });
  const setPhoto = (file: string | null) => {
    const { current, saved } = photoRef.current;
    if (current !== saved && current !== file) void ExercisePhotoStore.remove(current);
    photoRef.current.current = file;
    setPhotoState(file);
  };
  // Leaving without saving deletes a photo that was taken but never saved.
  useEffect(
    () => () => {
      const { current, saved } = photoRef.current;
      if (current !== saved) void ExercisePhotoStore.remove(current);
    },
    [],
  );
  const { control, handleSubmit, reset, setError, formState, watch } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(customExerciseSchema),
    defaultValues: { name: '', muscleGroup: 'chest', equipment: 'barbell', trackingType: 'weight_reps', instructions: '' },
  });

  useEffect(() => {
    navigation.setOptions({ title: id ? t('exercises.form.editTitle') : t('exercises.form.newTitle') });
    if (!id) return;
    services.exercises.get(id).then(e => {
      if (e) {
        reset({ name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment, trackingType: e.trackingType, instructions: e.instructions ?? '' });
      }
    }, toastError);
    services.exercises.photo(id).then(file => {
      photoRef.current = { current: file, saved: file };
      setPhotoState(file);
    }, toastError);
  }, [id, navigation, reset, services, t]);

  /**
   * Saves the photo if it changed and deletes the file it replaced. A failure
   * is reported but never blocks the exercise itself from being saved.
   */
  const commitPhoto = async (exerciseId: string) => {
    const { current, saved } = photoRef.current;
    if (current === saved) return;
    try {
      const replaced = await services.exercises.setPhoto(exerciseId, current);
      photoRef.current.saved = current;
      await ExercisePhotoStore.remove(replaced);
    } catch (err) {
      toastError(err);
    }
  };

  const submit = handleSubmit(async values => {
    setSaving(true);
    try {
      const input = { ...values, instructions: values.instructions || null };
      if (id) {
        await services.exercises.updateCustom(id, input);
        await commitPhoto(id);
        toast(t('exercises.form.saved'));
        navigation.goBack();
        return;
      }
      const e = await services.exercises.createCustom(input);
      await commitPhoto(e.id);
      toast(t('exercises.form.created'));
      if (pickFor?.mode === 'routine') {
        navigation.popTo('RoutineEditor', { addExerciseId: e.id, addNonce: Date.now() }, { merge: true });
      } else if (pickFor?.mode === 'add') {
        await store.getState().addExercise(e.id);
        navigation.popTo('Workout');
      } else if (pickFor?.mode === 'replace') {
        await store.getState().replaceExercise(pickFor.workoutExerciseId, e.id);
        navigation.popTo('Workout');
      } else {
        navigation.replace('ExerciseDetail', { id: e.id });
      }
    } catch (err) {
      if (isDomainError(err, 'DUPLICATE_NAME')) setError('name', { message: translateError(err) });
      else toastError(err);
    } finally {
      setSaving(false);
    }
  });

  const remove = () =>
    Alert.alert(t('exercises.form.deleteTitle'), t('exercises.form.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await services.exercises.deleteCustom(id!);
            toast(t('exercises.form.deleted'));
            navigation.popToTop();
          } catch (e) {
            toastError(e);
          }
        },
      },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <ExercisePhotoEditor
        file={photo}
        name={watch('name')}
        icon={iconForEquipment(watch('equipment'))}
        onChange={setPhoto}
      />
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <Field label={t('exercises.form.name')} error={fieldState.error?.message && translateMessage(fieldState.error.message)}>
            <TextField
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('exercises.form.namePlaceholder')}
              maxLength={80}
              autoFocus={!id}
              accessibilityLabel={t('exercises.form.nameA11y')}
              invalid={!!fieldState.error}
            />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="muscleGroup"
        render={({ field }) => (
          <Field label={t('exercises.form.muscleGroup')}>
            <ChoiceChips label={t('exercises.form.muscleGroup')} value={field.value} options={MUSCLE_GROUPS.map(g => [g, muscleGroupLabel(g, t)] as const)} onChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="equipment"
        render={({ field }) => (
          <Field label={t('exercises.form.equipment')}>
            <ChoiceChips label={t('exercises.form.equipment')} value={field.value} options={EQUIPMENT.map(g => [g, equipmentLabel(g, t)] as const)} onChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="trackingType"
        render={({ field }) => (
          <Field label={t('exercises.form.whatYouLog')}>
            <ChoiceChips
              label={t('exercises.form.whatYouLog')}
              value={field.value}
              options={TRACKING_TYPES.map(g => [g, trackingTypeLabel(g, t)] as const)}
              onChange={field.onChange}
            />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="instructions"
        render={({ field, fieldState }) => (
          <Field label={t('exercises.form.howToOptional')} error={fieldState.error?.message && translateMessage(fieldState.error.message)}>
            <TextField
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              maxLength={2000}
              accessibilityLabel={t('exercises.form.instructions')}
              style={s.multi}
            />
          </Field>
        )}
      />
      <Button label={id ? t('common.save') : t('exercises.create')} variant="ink" onPress={submit} busy={saving || formState.isSubmitting} />
      {id ? <Button label={t('exercises.form.deleteExercise')} variant="dangerText" onPress={remove} style={s.delete} /> : null}
    </ScrollView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    multi: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
    delete: { marginTop: 10 },
  });
