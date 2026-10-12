import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useServices } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import type {
  PlanDayView,
  WeekPlanView,
} from '../../application/plan/PlanService';
import type { RoutineSummary } from '../../application/routines/RoutineService';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ChoiceChips } from '../../components/common/FormControls';
import { Icon } from '../../components/common/Icon';
import { Sheet } from '../../components/common/Sheet';
import { WEEKDAY_SHORT, WEEKDAYS } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { useStartRoutine } from '../routines/RoutinesScreen';

const WEEK_START_OPTIONS = WEEKDAYS.map(
  d => [String(d), WEEKDAY_SHORT[d]] as const,
);

export function WeekPlanScreen({ navigation }: RootScreenProps<'WeekPlan'>) {
  const services = useServices();
  const s = useStyles(styles);
  const t = useTheme();
  const startRoutine = useStartRoutine(navigation);
  const [plan, setPlan] = useState<WeekPlanView | null>(null);
  const [choosingFor, setChoosingFor] = useState<PlanDayView | null>(null);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);

  const load = useCallback(
    () => services.plan.get().then(setPlan, toastError),
    [services],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = (p: Promise<unknown>) => p.then(load, toastError);

  const editDay = (d: PlanDayView) => {
    if (d.routine)
      navigation.navigate('RoutineEditor', { id: d.routine.routine.id });
    else navigation.navigate('RoutineEditor', { planDay: d.weekday });
  };

  const openChooser = (d: PlanDayView) => {
    setChoosingFor(d);
    services.routines.list().then(setRoutines, toastError);
  };

  if (!plan) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.colors.ink3} />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Card>
        <AppText variant="heading">Week starts on</AppText>
        <AppText variant="caption" color="ink3" style={s.sub}>
          Your plan shows the week in this order.
        </AppText>
        <ChoiceChips
          label="Week starts on"
          value={String(plan.weekStart)}
          options={WEEK_START_OPTIONS}
          onChange={v => void run(services.plan.setWeekStart(Number(v)))}
        />
        <AppText variant="caption" color="ink2" style={s.summary}>
          {plan.trainingDays} training{' '}
          {plan.trainingDays === 1 ? 'day' : 'days'} · {plan.restDays} rest{' '}
          {plan.restDays === 1 ? 'day' : 'days'}
        </AppText>
      </Card>

      {plan.days.map(d => (
        <View key={d.weekday} style={[s.day, d.isToday && s.today]}>
          <View style={s.dayHead}>
            <View style={s.flex}>
              <AppText variant="heading">
                {d.name}
                {d.isToday ? (
                  <AppText variant="label" color="accent">
                    {'  '}Today
                  </AppText>
                ) : null}
              </AppText>
              <AppText
                variant="caption"
                color={d.kind === 'rest' ? 'good' : 'ink3'}
              >
                {d.kind === 'rest'
                  ? 'Rest day'
                  : d.kind === 'training'
                  ? `${d.routine!.routine.name} · ${
                      d.routine!.exerciseNames.length
                    } exercises`
                  : 'Not planned'}
              </AppText>
            </View>
            <View style={s.restToggle}>
              <AppText variant="caption" color="ink3">
                Rest
              </AppText>
              <Switch
                value={d.kind === 'rest'}
                onValueChange={v =>
                  void run(services.plan.setRest(d.weekday, v))
                }
                trackColor={{ true: t.colors.good, false: t.colors.raise }}
                accessibilityLabel={`${d.name} is a rest day`}
              />
            </View>
          </View>

          {d.kind === 'training' ? (
            <AppText style={s.list} numberOfLines={3}>
              {d.routine!.exerciseNames.join(', ')}
            </AppText>
          ) : null}

          {d.kind !== 'rest' ? (
            <View style={s.actions}>
              <Button
                label={
                  d.kind === 'training' ? 'Edit exercises' : 'Add exercises'
                }
                variant={d.kind === 'training' ? 'outline' : 'ink'}
                compact
                onPress={() => editDay(d)}
                accessibilityHint={`Opens the exercise list for ${d.name}`}
                style={s.flex}
              />
              <Pressable
                style={s.more}
                onPress={() => openChooser(d)}
                accessibilityRole="button"
                accessibilityLabel={`Use a saved routine on ${d.name}`}
              >
                <Icon name="copy" size={18} tint="ink2" />
              </Pressable>
              {d.isToday && d.routine ? (
                <Button
                  label="Start"
                  compact
                  onPress={() => void startRoutine(d.routine!.routine.id)}
                />
              ) : null}
            </View>
          ) : (
            <AppText variant="caption" color="ink3" style={s.list}>
              Recovery is part of training.
            </AppText>
          )}
        </View>
      ))}

      <Sheet
        visible={!!choosingFor}
        onClose={() => setChoosingFor(null)}
        title={choosingFor ? `${choosingFor.name}: use a routine` : ''}
      >
        {routines.length ? (
          routines.map(r => (
            <Pressable
              key={r.routine.id}
              style={s.pick}
              accessibilityRole="button"
              onPress={() => {
                const day = choosingFor!;
                setChoosingFor(null);
                void run(
                  services.plan.assignRoutine(day.weekday, r.routine.id),
                );
              }}
            >
              <View style={s.flex}>
                <AppText variant="label">{r.routine.name}</AppText>
                <AppText variant="caption" color="ink3" numberOfLines={1}>
                  {r.exerciseNames.join(', ')}
                </AppText>
              </View>
              <Icon name="chevronRight" size={18} tint="ink3" />
            </Pressable>
          ))
        ) : (
          <AppText color="ink2">
            No saved routines yet. Use “Add exercises” to build this day.
          </AppText>
        )}
        {choosingFor?.kind === 'training' ? (
          <Button
            label="Clear this day"
            variant="dangerText"
            onPress={() => {
              const day = choosingFor;
              setChoosingFor(null);
              void run(services.plan.assignRoutine(day.weekday, null));
            }}
          />
        ) : null}
      </Sheet>
    </ScrollView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 48 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.bg,
    },
    flex: { flex: 1 },
    sub: { marginTop: 2, marginBottom: 10 },
    summary: { marginTop: 12 },
    day: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      padding: 14,
      marginTop: 12,
    },
    today: { borderColor: t.colors.amber, borderWidth: 2 },
    dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    restToggle: { alignItems: 'center', gap: 2 },
    list: { marginTop: 8 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    more: {
      width: 48,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pick: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.line,
    },
  });
