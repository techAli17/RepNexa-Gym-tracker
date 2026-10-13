import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
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
import { SkeletonList } from '../../components/common/Skeleton';
import { WEEKDAYS } from '../../domain/models';
import { useT } from '../../i18n';
import { weekdayName, weekdayShort } from '../../i18n/labels';
import { toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { useStartRoutine } from '../routines/RoutinesScreen';

export function WeekPlanScreen({ navigation }: RootScreenProps<'WeekPlan'>) {
  const services = useServices();
  const s = useStyles(styles);
  const theme = useTheme();
  const { t, tn } = useT();
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

  const weekStartOptions = WEEKDAYS.map(
    d => [String(d), weekdayShort(d, t)] as const,
  );

  if (!plan) {
    return (
      <View style={s.screen}>
        <SkeletonList rows={7} rowHeight={84} />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Card>
        <AppText variant="heading">{t('plan.weekStartsOn')}</AppText>
        <AppText variant="caption" color="ink3" style={s.sub}>
          {t('plan.weekStartsSub')}
        </AppText>
        <ChoiceChips
          label={t('plan.weekStartsOn')}
          value={String(plan.weekStart)}
          options={weekStartOptions}
          onChange={v => void run(services.plan.setWeekStart(Number(v)))}
        />
        <AppText variant="caption" color="ink2" style={s.summary}>
          {tn('plan.trainingDays', plan.trainingDays)} ·{' '}
          {tn('plan.restDays', plan.restDays)}
        </AppText>
      </Card>

      {plan.days.map(d => (
        <View key={d.weekday} style={[s.day, d.isToday && s.today]}>
          <View style={s.dayHead}>
            <View style={s.flex}>
              <AppText variant="heading">
                {weekdayName(d.weekday, t)}
                {d.isToday ? (
                  <AppText variant="label" color="accent">
                    {'  '}
                    {t('plan.today')}
                  </AppText>
                ) : null}
              </AppText>
              <AppText
                variant="caption"
                color={d.kind === 'rest' ? 'good' : 'ink3'}
              >
                {d.kind === 'rest'
                  ? t('plan.restDay')
                  : d.kind === 'training'
                  ? t('plan.routineSummary', {
                      routine: d.routine!.routine.name,
                      count: d.routine!.exerciseNames.length,
                    })
                  : t('plan.notPlanned')}
              </AppText>
            </View>
            <View style={s.restToggle}>
              <AppText variant="caption" color="ink3">
                {t('plan.rest')}
              </AppText>
              <Switch
                value={d.kind === 'rest'}
                onValueChange={v =>
                  void run(services.plan.setRest(d.weekday, v))
                }
                trackColor={{
                  true: theme.colors.good,
                  false: theme.colors.raise,
                }}
                accessibilityLabel={t('plan.restA11y', {
                  day: weekdayName(d.weekday, t),
                })}
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
                  d.kind === 'training'
                    ? t('plan.editExercises')
                    : t('plan.addExercises')
                }
                variant={d.kind === 'training' ? 'outline' : 'ink'}
                compact
                onPress={() => editDay(d)}
                accessibilityHint={t('plan.editHint', {
                  day: weekdayName(d.weekday, t),
                })}
                style={s.flex}
              />
              <Pressable
                style={s.more}
                onPress={() => openChooser(d)}
                accessibilityRole="button"
                accessibilityLabel={t('plan.useRoutineA11y', {
                  day: weekdayName(d.weekday, t),
                })}
              >
                <Icon name="copy" size={18} tint="ink2" />
              </Pressable>
              {d.isToday && d.routine ? (
                <Button
                  label={t('plan.start')}
                  compact
                  onPress={() => void startRoutine(d.routine!.routine.id)}
                />
              ) : null}
            </View>
          ) : (
            <AppText variant="caption" color="ink3" style={s.list}>
              {t('plan.recovery')}
            </AppText>
          )}
        </View>
      ))}

      <Sheet
        visible={!!choosingFor}
        onClose={() => setChoosingFor(null)}
        title={
          choosingFor
            ? t('plan.chooserTitle', {
                day: weekdayName(choosingFor.weekday, t),
              })
            : ''
        }
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
          <AppText color="ink2">{t('plan.noRoutines')}</AppText>
        )}
        {choosingFor?.kind === 'training' ? (
          <Button
            label={t('plan.clearDay')}
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
