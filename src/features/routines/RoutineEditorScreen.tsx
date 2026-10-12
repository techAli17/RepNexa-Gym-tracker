import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useServices, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Field, TextField } from '../../components/common/FormControls';
import { Icon } from '../../components/common/Icon';
import { Stepper } from '../../components/common/Stepper';
import { RestPickerSheet } from '../../components/workout/RestPickerSheet';
import { routineInputSchema } from '../../domain/validation';
import { toast, toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

type FormIn = z.input<typeof routineInputSchema>;
type FormOut = z.output<typeof routineInputSchema>;

const restText = (sec: number | null | undefined, fallback: number) => {
  const v = sec ?? fallback;
  return `${sec == null ? 'Default ' : ''}${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export function RoutineEditorScreen({ navigation, route }: RootScreenProps<'RoutineEditor'>) {
  const { id, addExerciseId, addNonce } = route.params ?? {};
  const services = useServices();
  const defaultRest = useSettings(x => x.settings.defaultRestSeconds);
  const s = useStyles(styles);
  const [names, setNames] = useState<Record<string, string>>({});
  const [restIndex, setRestIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, reset, formState, watch } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(routineInputSchema),
    defaultValues: { name: '', notes: '', exercises: [] },
  });
  const { fields, append, remove, move, update } = useFieldArray({ control, name: 'exercises' });
  const exercises = watch('exercises');

  useEffect(() => {
    navigation.setOptions({ title: id ? 'Edit routine' : 'New routine' });
    if (!id) return;
    services.routines.get(id).then(v => {
      if (!v) return;
      setNames(Object.fromEntries(Object.values(v.exercises).map(e => [e.id, e.name])));
      reset({
        name: v.detail.routine.name,
        notes: v.detail.routine.notes ?? '',
        exercises: v.detail.exercises.map(e => ({
          exerciseId: e.exerciseId,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          restSeconds: e.restSeconds,
          notes: e.notes,
        })),
      });
    }, toastError);
  }, [id, navigation, reset, services]);

  // The picker hands a chosen exercise back through params; the nonce makes repeats count.
  useEffect(() => {
    if (!addExerciseId) return;
    services.exercises.get(addExerciseId).then(e => {
      if (!e) return;
      setNames(n => ({ ...n, [e.id]: e.name }));
      append({ exerciseId: e.id, targetSets: 3, targetReps: e.trackingType === 'weight_reps' || e.trackingType === 'bodyweight_reps' ? 10 : null, restSeconds: null });
    }, toastError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addExerciseId, addNonce]);

  const submit = handleSubmit(async values => {
    setSaving(true);
    try {
      if (id) await services.routines.update(id, values);
      else await services.routines.create(values);
      toast('Routine saved');
      navigation.goBack();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  });

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
              placeholder="e.g. Push A"
              maxLength={80}
              accessibilityLabel="Routine name"
              invalid={!!fieldState.error}
            />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <Field label="Notes (optional)">
            <TextField value={field.value ?? ''} onChangeText={field.onChange} multiline maxLength={1000} accessibilityLabel="Routine notes" style={s.multi} />
          </Field>
        )}
      />

      <AppText variant="heading" style={s.h}>
        Exercises
      </AppText>
      {formState.errors.exercises?.message || formState.errors.exercises?.root?.message ? (
        <AppText color="danger" style={s.err}>
          {formState.errors.exercises?.message ?? formState.errors.exercises?.root?.message}
        </AppText>
      ) : null}

      {fields.map((f, i) => {
        const v = exercises[i];
        if (!v) return null;
        const name = names[v.exerciseId] ?? 'Exercise';
        return (
          <View key={f.id} style={s.item}>
            <View style={s.itemHead}>
              <AppText variant="label" style={s.itemName} numberOfLines={2}>
                {i + 1}. {name}
              </AppText>
              <IconBtn icon="arrowUp" label={`Move ${name} up`} disabled={i === 0} onPress={() => move(i, i - 1)} />
              <IconBtn icon="arrowDown" label={`Move ${name} down`} disabled={i === fields.length - 1} onPress={() => move(i, i + 1)} />
              <IconBtn icon="trash" label={`Remove ${name}`} danger onPress={() => remove(i)} />
            </View>
            <View style={s.itemRow}>
              <View style={s.ctrl}>
                <AppText variant="caption" color="ink3">
                  Sets
                </AppText>
                <Stepper label={`Sets for ${name}`} value={v.targetSets} min={1} max={20} onChange={n => update(i, { ...v, targetSets: n })} />
              </View>
              <View style={s.ctrl}>
                <AppText variant="caption" color="ink3">
                  Reps
                </AppText>
                <Stepper
                  label={`Target reps for ${name}`}
                  value={v.targetReps ?? 0}
                  min={0}
                  max={100}
                  format={n => (n === 0 ? 'Any' : String(n))}
                  onChange={n => update(i, { ...v, targetReps: n === 0 ? null : n })}
                />
              </View>
            </View>
            <Pressable style={s.rest} onPress={() => setRestIndex(i)} accessibilityRole="button" accessibilityLabel={`Rest for ${name}: ${restText(v.restSeconds, defaultRest)}`}>
              <Icon name="timer" size={16} tint="ink2" />
              <AppText variant="caption" color="ink2">
                Rest {restText(v.restSeconds, defaultRest)}
              </AppText>
            </Pressable>
          </View>
        );
      })}

      <Button label="+ Add exercise" variant="ghost" onPress={() => navigation.navigate('ExercisePicker', { mode: 'routine' })} style={s.add} />
      <Button label="Save routine" variant="ink" onPress={submit} busy={saving} style={s.save} />

      <RestPickerSheet
        visible={restIndex != null}
        current={restIndex != null ? exercises[restIndex]?.restSeconds ?? null : null}
        defaultSeconds={defaultRest}
        onClose={() => setRestIndex(null)}
        onPick={sec => {
          if (restIndex != null && exercises[restIndex]) update(restIndex, { ...exercises[restIndex], restSeconds: sec });
          setRestIndex(null);
        }}
      />
    </ScrollView>
  );
}

function IconBtn({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const s = useStyles(styles);
  return (
    <Pressable
      style={[s.iconBtn, disabled && s.dim]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Icon name={icon} size={18} tint={danger ? 'danger' : 'ink2'} />
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 48 },
    multi: { minHeight: 70, paddingTop: 12, textAlignVertical: 'top' },
    h: { marginTop: 4, marginBottom: 8 },
    err: { marginBottom: 8 },
    item: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      padding: 12,
      marginBottom: 10,
    },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    itemName: { flex: 1, fontSize: 16, fontWeight: '700' },
    itemRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
    ctrl: { gap: 4 },
    rest: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 32, alignSelf: 'flex-start' },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    dim: { opacity: 0.35 },
    add: { marginTop: 4 },
    save: { marginTop: 14 },
  });
