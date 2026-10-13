import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useActiveWorkout, useActiveWorkoutStore, useServices } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import type { RoutineSummary } from '../../application/routines/RoutineService';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon } from '../../components/common/Icon';
import { ROUTINE_TEMPLATES } from '../../data/routines/templates';
import type { RoutineTemplate } from '../../domain/models';
import { useT } from '../../i18n';
import { toast, toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

/** Starts a routine, or offers to resume when a workout is already running. */
export function useStartRoutine(navigation: { navigate(screen: 'Workout'): void }) {
  const store = useActiveWorkoutStore();
  const active = useActiveWorkout(x => x.detail);
  const { t } = useT();
  return useCallback(
    async (routineId: string) => {
      if (active) {
        Alert.alert(t('routines.inProgressTitle'), t('routines.inProgressMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('routines.resumeIt'), onPress: () => navigation.navigate('Workout') },
        ]);
        return;
      }
      try {
        await store.getState().startRoutine(routineId);
        navigation.navigate('Workout');
      } catch (e) {
        toastError(e);
      }
    },
    [active, store, navigation, t],
  );
}

export function RoutinesScreen({ navigation }: RootScreenProps<'Routines'>) {
  const services = useServices();
  const s = useStyles(styles);
  const { t } = useT();
  const [list, setList] = useState<RoutineSummary[] | null>(null);
  const start = useStartRoutine(navigation);

  const load = useCallback(() => services.routines.list().then(setList, toastError), [services]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = (p: Promise<unknown>, msg?: string) =>
    p.then(() => {
      if (msg) toast(msg);
      return load();
    }, toastError);

  const moveBy = (i: number, d: -1 | 1) => {
    if (!list) return;
    const ids = list.map(x => x.routine.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run(services.routines.reorder(ids));
  };

  const menu = (r: RoutineSummary, i: number) => {
    const opts: Array<[string, () => void, boolean?]> = [
      [t('common.edit'), () => navigation.navigate('RoutineEditor', { id: r.routine.id })],
      [t('routines.duplicate'), () => void run(services.routines.duplicate(r.routine.id), t('routines.duplicated'))],
      [t('routines.moveUp'), () => moveBy(i, -1)],
      [t('routines.moveDown'), () => moveBy(i, 1)],
      [
        t('common.delete'),
        () =>
          Alert.alert(t('routines.deleteTitle', { name: r.routine.name }), t('routines.deleteMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: () => void run(services.routines.remove(r.routine.id), t('routines.deleted')),
            },
          ]),
        true,
      ],
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...opts.map(o => o[0]), t('common.cancel')], cancelButtonIndex: opts.length, destructiveButtonIndex: opts.length - 1, title: r.routine.name },
        idx => opts[idx]?.[1](),
      );
    } else {
      Alert.alert(r.routine.name, undefined, [
        ...opts.slice(0, 2).map(([text, onPress]) => ({ text, onPress })),
        {
          text: t('routines.more'),
          onPress: () =>
            Alert.alert(r.routine.name, undefined, [
              ...opts.slice(2).map(([text, onPress, d]) => ({ text, onPress, style: d ? ('destructive' as const) : undefined })),
              { text: t('common.cancel'), style: 'cancel' as const },
            ]),
        },
      ]);
    }
  };

  const addTemplate = (tpl: RoutineTemplate) =>
    void run(services.routines.createFromTemplate(tpl), t('routines.templateAdded', { name: tpl.name }));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Button label={t('routines.newRoutine')} variant="ink" onPress={() => navigation.navigate('RoutineEditor', {})} />
      {list && !list.length ? (
        <EmptyState title={t('routines.emptyTitle')} message={t('routines.emptyMessage')} />
      ) : null}
      {list?.map((r, i) => (
        <View key={r.routine.id} style={s.card}>
          <Pressable
            style={s.cardMain}
            onPress={() => navigation.navigate('RoutineEditor', { id: r.routine.id })}
            accessibilityRole="button"
            accessibilityHint={t('routines.editHint')}
          >
            <AppText variant="heading">{r.routine.name}</AppText>
            <AppText variant="caption" color="ink3" numberOfLines={2}>
              {r.exerciseNames.join(', ')}
            </AppText>
            <AppText variant="caption" color="ink3">
              {t('routines.summary', { exercises: r.exerciseNames.length, sets: r.totalSets })}
            </AppText>
          </Pressable>
          <View style={s.cardActions}>
            <Button label={t('routines.start')} compact onPress={() => void start(r.routine.id)} />
            <Pressable style={s.more} onPress={() => menu(r, i)} accessibilityRole="button" accessibilityLabel={t('routines.moreOptionsA11y', { name: r.routine.name })}>
              <Icon name="more" size={20} tint="ink2" />
            </Pressable>
          </View>
        </View>
      ))}

      <AppText variant="heading" style={s.h}>
        {t('routines.templates')}
      </AppText>
      <AppText variant="caption" color="ink3" style={s.sub}>
        {t('routines.templatesSub')}
      </AppText>
      {ROUTINE_TEMPLATES.map(tpl => (
        <View key={tpl.key} style={s.template}>
          <View style={s.flex}>
            <AppText variant="label" style={s.tName}>
              {tpl.name}
            </AppText>
            <AppText variant="caption" color="ink3">
              {t('routines.templateSummary', { description: tpl.description, count: tpl.exercises.length })}
            </AppText>
          </View>
          <Button label={t('routines.add')} variant="outline" compact onPress={() => addTemplate(tpl)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 48 },
    flex: { flex: 1 },
    card: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      padding: 14,
      marginTop: 12,
    },
    cardMain: { gap: 3 },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    more: {
      width: 48,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    h: { marginTop: 28 },
    sub: { marginTop: 2, marginBottom: 8 },
    template: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      padding: 14,
      marginBottom: 8,
    },
    tName: { fontSize: 16, fontWeight: '800' },
  });
