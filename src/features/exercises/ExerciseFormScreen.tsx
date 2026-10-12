import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useActiveWorkoutStore, useServices } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { Button } from '../../components/common/Button';
import { ChoiceChips, Field, TextField } from '../../components/common/FormControls';
import { isDomainError } from '../../domain/errors';
import { EQUIPMENT, MUSCLE_GROUPS, TRACKING_TYPES, type TrackingType } from '../../domain/models';
import { customExerciseSchema } from '../../domain/validation';
import { toast, toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { titleCase } from '../../utils/text';

type FormIn = z.input<typeof customExerciseSchema>;
type FormOut = z.output<typeof customExerciseSchema>;

const TRACKING_LABEL: Record<TrackingType, string> = {
  weight_reps: 'Weight × reps',
  bodyweight_reps: 'Bodyweight reps',
  duration: 'Time',
  distance_duration: 'Distance + time',
};

/** Create or edit a custom exercise. Opened from the picker, the new exercise is applied to that flow. */
export function ExerciseFormScreen({ navigation, route }: RootScreenProps<'ExerciseForm'>) {
  const { id, pickFor } = route.params ?? {};
  const services = useServices();
  const store = useActiveWorkoutStore();
  const s = useStyles(styles);
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, reset, setError, formState } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(customExerciseSchema),
    defaultValues: { name: '', muscleGroup: 'chest', equipment: 'barbell', trackingType: 'weight_reps', instructions: '' },
  });

  useEffect(() => {
    navigation.setOptions({ title: id ? 'Edit exercise' : 'New exercise' });
    if (!id) return;
    services.exercises.get(id).then(e => {
      if (e) {
        reset({ name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment, trackingType: e.trackingType, instructions: e.instructions ?? '' });
      }
    }, toastError);
  }, [id, navigation, reset, services]);

  const submit = handleSubmit(async values => {
    setSaving(true);
    try {
      const input = { ...values, instructions: values.instructions || null };
      if (id) {
        await services.exercises.updateCustom(id, input);
        toast('Exercise saved');
        navigation.goBack();
        return;
      }
      const e = await services.exercises.createCustom(input);
      toast('Exercise created');
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
      if (isDomainError(err, 'DUPLICATE_NAME')) setError('name', { message: err.message });
      else toastError(err);
    } finally {
      setSaving(false);
    }
  });

  const remove = () =>
    Alert.alert('Delete this exercise?', 'It disappears from the library. Workouts where you logged it keep it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await services.exercises.deleteCustom(id!);
            toast('Exercise deleted');
            navigation.popToTop();
          } catch (e) {
            toastError(e);
          }
        },
      },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <Field label="Name" error={fieldState.error?.message}>
            <TextField
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="e.g. Zercher Squat"
              maxLength={80}
              autoFocus={!id}
              accessibilityLabel="Exercise name"
              invalid={!!fieldState.error}
            />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="muscleGroup"
        render={({ field }) => (
          <Field label="Muscle group">
            <ChoiceChips label="Muscle group" value={field.value} options={MUSCLE_GROUPS.map(g => [g, titleCase(g)] as const)} onChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="equipment"
        render={({ field }) => (
          <Field label="Equipment">
            <ChoiceChips label="Equipment" value={field.value} options={EQUIPMENT.map(g => [g, titleCase(g)] as const)} onChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="trackingType"
        render={({ field }) => (
          <Field label="What you log">
            <ChoiceChips
              label="What you log"
              value={field.value}
              options={TRACKING_TYPES.map(g => [g, TRACKING_LABEL[g]] as const)}
              onChange={field.onChange}
            />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="instructions"
        render={({ field, fieldState }) => (
          <Field label="How to do it (optional)" error={fieldState.error?.message}>
            <TextField
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              maxLength={2000}
              accessibilityLabel="Instructions"
              style={s.multi}
            />
          </Field>
        )}
      />
      <Button label={id ? 'Save' : 'Create exercise'} variant="ink" onPress={submit} busy={saving || formState.isSubmitting} />
      {id ? <Button label="Delete exercise" variant="dangerText" onPress={remove} style={s.delete} /> : null}
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
