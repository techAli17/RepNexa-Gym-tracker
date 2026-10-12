import React, { useCallback, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  useActiveWorkout,
  useActiveWorkoutStore,
  useServices,
  useSettings,
} from '../../app/AppContext';
import type { TabScreenProps } from '../../app/navigation/types';
import type { WeekBucket } from '../../application/analytics/AnalyticsService';
import type { WeekSummary } from '../../application/history/HistoryService';
import type { RoutineSummary } from '../../application/routines/RoutineService';
import { BarChart } from '../../components/charts/ProgressChart';
import { AppText } from '../../components/common/AppText';
import { BackupStatus } from '../../components/common/BackupStatus';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Icon } from '../../components/common/Icon';
import { ElapsedClock } from '../../components/workout/ElapsedClock';
import { WorkoutRow } from '../../components/workout/WorkoutRow';
import { convertWeight } from '../../domain/calculations';
import type { WorkoutListItem } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatDuration, formatVolume } from '../../utils/format';
import { useStartRoutine } from '../routines/RoutinesScreen';
import type { WeekPlanView } from '../../application/plan/PlanService';
import { WEEKDAY_SHORT } from '../../domain/models';
import { GymPhotoStore } from '../../infrastructure/gym-photo/GymPhotoStore';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** The routine after the one used most recently, so a rotation (push/pull/legs) suggests itself. */
function nextRoutine(
  routines: RoutineSummary[],
  recent: WorkoutListItem[],
): RoutineSummary | null {
  if (!routines.length) return null;
  const last = recent.find(r => r.workout.routineId)?.workout.routineId;
  const i = routines.findIndex(r => r.routine.id === last);
  return routines[(i + 1) % routines.length];
}

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const services = useServices();
  const store = useActiveWorkoutStore();
  const active = useActiveWorkout(s => s.detail);
  const unit = useSettings(s => s.settings.weightUnit);
  const s = useStyles(styles);
  const startRoutine = useStartRoutine(navigation);
  const [recent, setRecent] = useState<WorkoutListItem[]>([]);
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [streak, setStreak] = useState(0);
  const [plan, setPlan] = useState<WeekPlanView | null>(null);
  const gymName = useSettings(x => x.settings.gymName);
  const gymPhoto = useSettings(x => x.settings.gymPhotoFile);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, w, ws, rs, st, pl] = await Promise.all([
        services.history.list({ limit: 5 }),
        services.history.thisWeek(),
        services.analytics.weekly(8),
        services.routines.list(),
        services.analytics.weekStreak(),
        services.plan.get(),
      ]);
      setPlan(pl);
      setRecent(r);
      setWeek(w);
      setWeeks(ws);
      setRoutines(rs);
      setStreak(st);
    } catch (e) {
      toastError(e);
    }
  }, [services]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const startEmpty = async () => {
    if (active) return navigation.navigate('Workout');
    if (starting) return;
    setStarting(true);
    try {
      await store.getState().startEmpty();
      navigation.navigate('Workout');
    } catch (e) {
      toastError(e);
    } finally {
      setStarting(false);
    }
  };

  const todayIndex = (new Date().getDay() + 6) % 7;
  const today = plan?.days.find(d => d.isToday) ?? null;
  const planned = !!plan && plan.days.some(d => d.kind !== 'unplanned');
  // A planned training day wins; on unplanned days the routine rotation suggests one.
  const next =
    today?.kind === 'training'
      ? today.routine
      : today?.kind === 'rest'
      ? null
      : nextRoutine(routines, recent);
  const df = (ts: number) => formatDate(ts, { day: 'numeric', month: 'short' });

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {gymName || gymPhoto ? (
        <Pressable
          style={s.gym}
          onPress={() => navigation.navigate('GymProfile')}
          accessibilityRole="button"
          accessibilityLabel={`${gymName ?? 'My gym'}. Edit gym photo and name`}
        >
          {gymPhoto ? (
            <ImageBackground
              source={{ uri: GymPhotoStore.uri(gymPhoto) }}
              style={s.gymImage}
              resizeMode="cover"
            >
              <View style={s.gymShade}>
                <AppText style={s.gymName} numberOfLines={1}>
                  {gymName ?? 'My gym'}
                </AppText>
              </View>
            </ImageBackground>
          ) : (
            <View style={s.gymPlain}>
              <Icon name="barbell" size={20} tint="ink2" />
              <AppText variant="heading" numberOfLines={1}>
                {gymName}
              </AppText>
            </View>
          )}
        </Pressable>
      ) : null}
      <AppText color="ink2">{greeting()}</AppText>
      <View style={s.mtSm}>
        <BackupStatus onPress={() => navigation.navigate('Backup')} />
      </View>

      {active ? (
        <Pressable
          style={s.hero}
          onPress={() => navigation.navigate('Workout')}
          accessibilityRole="button"
          accessibilityLabel={`Resume ${active.workout.name}`}
          accessibilityHint="Opens the workout in progress"
        >
          <View style={s.flex}>
            <AppText variant="caption" style={s.onAmberDim}>
              {active.workout.pausedAt
                ? 'Paused workout'
                : 'Workout in progress'}
            </AppText>
            <AppText style={s.heroTitle} numberOfLines={1}>
              {active.workout.name}
            </AppText>
            <ElapsedClock workout={active.workout} style={s.onAmber} />
          </View>
          <View style={s.heroGo}>
            <AppText variant="label" style={s.heroGoText}>
              Resume
            </AppText>
          </View>
        </Pressable>
      ) : next ? (
        <Pressable
          style={s.hero}
          onPress={() => void startRoutine(next.routine.id)}
          accessibilityRole="button"
          accessibilityLabel={`${
            today?.kind === 'training' ? `Today, ${today.name}` : 'Next up'
          }: ${next.routine.name}, ${next.exerciseNames.length} exercises`}
          accessibilityHint="Starts this routine"
        >
          <View style={s.flex}>
            <AppText variant="caption" style={s.onAmberDim}>
              {today?.kind === 'training' ? `Today · ${today.name}` : 'Next up'}
            </AppText>
            <AppText style={s.heroTitle} numberOfLines={1}>
              {next.routine.name}
            </AppText>
            <AppText variant="caption" style={s.onAmberDim} numberOfLines={2}>
              {next.exerciseNames.slice(0, 4).join(', ')}
              {next.exerciseNames.length > 4
                ? ` +${next.exerciseNames.length - 4}`
                : ''}
            </AppText>
          </View>
          <View style={s.heroGo}>
            <Icon name="play" size={16} color={s.heroGoText.color as string} />
            <AppText variant="label" style={s.heroGoText}>
              Start
            </AppText>
          </View>
        </Pressable>
      ) : today?.kind === 'rest' ? (
        <View
          style={s.rest}
          accessible
          accessibilityLabel={`Today, ${today.name}: rest day`}
        >
          <AppText variant="caption" color="good">
            Today · {today.name}
          </AppText>
          <AppText style={s.restTitle}>Rest day</AppText>
          <AppText color="ink2">
            Recovery is part of training. You can still log a workout below.
          </AppText>
        </View>
      ) : null}

      {plan ? (
        <Pressable
          style={s.weekStrip}
          onPress={() => navigation.navigate('WeekPlan')}
          accessibilityRole="button"
          accessibilityLabel={
            planned
              ? `Weekly plan: ${plan.days
                  .map(
                    d =>
                      `${d.name} ${
                        d.kind === 'training'
                          ? d.routine!.routine.name
                          : d.kind === 'rest'
                          ? 'rest'
                          : 'not planned'
                      }`,
                  )
                  .join(', ')}`
              : 'Plan your week'
          }
        >
          {planned ? (
            plan.days.map(d => (
              <View
                key={d.weekday}
                style={[s.planDay, d.isToday && s.planDayToday]}
                importantForAccessibility="no-hide-descendants"
              >
                <AppText
                  variant="caption"
                  color={d.isToday ? 'accent' : 'ink3'}
                  style={s.planDayName}
                >
                  {WEEKDAY_SHORT[d.weekday]}
                </AppText>
                <View
                  style={[
                    s.planDot,
                    d.kind === 'training' && s.planDotOn,
                    d.kind === 'rest' && s.planDotRest,
                  ]}
                >
                  <AppText
                    style={[
                      s.planDotText,
                      d.kind === 'training' && s.planDotTextOn,
                    ]}
                  >
                    {d.kind === 'rest' ? 'R' : d.kind === 'training' ? '•' : ''}
                  </AppText>
                </View>
              </View>
            ))
          ) : (
            <View style={s.planEmpty}>
              <Icon name="timer" size={20} tint="accent" />
              <View style={s.flex}>
                <AppText variant="label">Plan your week</AppText>
                <AppText variant="caption" color="ink3">
                  Choose training and rest days, and what to train each day.
                </AppText>
              </View>
              <Icon name="chevronRight" size={18} tint="ink3" />
            </View>
          )}
        </Pressable>
      ) : null}

      {!active ? (
        <Button
          label="+ Start empty workout"
          variant={next ? 'ghost' : 'primary'}
          onPress={() => void startEmpty()}
          busy={starting}
          style={s.mtSm}
        />
      ) : null}

      <Card style={s.mt}>
        <View style={s.cardHead}>
          <AppText variant="heading">This week</AppText>
          {streak ? (
            <AppText variant="caption" color="accent" style={s.bold}>
              {streak}-week streak
            </AppText>
          ) : null}
        </View>
        <View
          style={s.days}
          accessible
          accessibilityLabel={`Trained on ${
            week?.activeDays.map(d => DAY_NAMES[d]).join(', ') || 'no days yet'
          } this week`}
        >
          {DAYS.map((d, i) => {
            const on = week?.activeDays.includes(i);
            return (
              <View key={i} style={s.day}>
                <AppText variant="caption" color="ink3">
                  {d}
                </AppText>
                <View
                  style={[s.dot, on && s.dotOn, i === todayIndex && s.dotToday]}
                >
                  {on ? <Icon name="check" size={16} tint="bg" /> : null}
                </View>
              </View>
            );
          })}
        </View>
        <View style={s.stats}>
          <Stat value={String(week?.workouts ?? 0)} label="Workouts" />
          <Stat
            value={formatDuration(week?.durationMs ?? 0)}
            label="Time"
            divider
          />
          <Stat
            value={formatVolume(week?.volumeKg ?? 0, unit)}
            label={`Volume, ${unit}`}
            divider
          />
        </View>
      </Card>

      {weeks.some(w => w.volumeKg > 0) ? (
        <Card style={s.mt}>
          <View style={s.cardHead}>
            <AppText variant="heading">Weekly volume</AppText>
            <AppText variant="caption" color="ink3">
              Last 8 weeks, {unit}
            </AppText>
          </View>
          <BarChart
            bars={weeks.map(w => ({
              value: convertWeight(w.volumeKg, 'kg', unit),
              label: df(w.weekStart),
            }))}
            formatValue={v => formatVolume(v, 'kg')}
            accessibilityLabel={`Weekly volume: ${weeks
              .map(
                w =>
                  `week of ${df(w.weekStart)} ${formatVolume(
                    w.volumeKg,
                    unit,
                  )} ${unit}`,
              )
              .join(', ')}`}
          />
        </Card>
      ) : null}

      <View style={s.sectionRow}>
        <AppText variant="heading">Routines</AppText>
        <Pressable
          onPress={() => navigation.navigate('Routines')}
          accessibilityRole="button"
          hitSlop={10}
        >
          <AppText variant="label" color="accent">
            {routines.length ? 'Manage' : 'Add routines'}
          </AppText>
        </Pressable>
      </View>
      {routines.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.carousel}
          contentContainerStyle={s.carouselBody}
        >
          {routines.map(r => (
            <View key={r.routine.id} style={s.rcard}>
              <AppText variant="heading" numberOfLines={1}>
                {r.routine.name}
              </AppText>
              <AppText
                variant="caption"
                color="ink3"
                numberOfLines={3}
                style={s.rcardList}
              >
                {r.exerciseNames.join(', ')}
              </AppText>
              <Button
                label="Start"
                variant="outline"
                compact
                onPress={() => void startRoutine(r.routine.id)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <AppText color="ink2">
          Save your regular workouts as routines, or start from push / pull /
          legs templates.
        </AppText>
      )}

      <View style={s.sectionRow}>
        <AppText variant="heading">Recent workouts</AppText>
        {recent.length ? (
          <Pressable
            onPress={() => navigation.navigate('History')}
            accessibilityRole="button"
            hitSlop={10}
          >
            <AppText variant="label" color="accent">
              See all
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {recent.length ? (
        recent
          .slice(0, 3)
          .map(r => (
            <WorkoutRow
              key={r.workout.id}
              item={r}
              unit={unit}
              onPress={id => navigation.navigate('WorkoutDetail', { id })}
            />
          ))
      ) : (
        <AppText color="ink2">
          Your finished workouts will show up here.
        </AppText>
      )}
    </ScrollView>
  );
}

function Stat({
  value,
  label,
  divider,
}: {
  value: string;
  label: string;
  divider?: boolean;
}) {
  const s = useStyles(styles);
  return (
    <View style={[s.stat, divider && s.statDivider]}>
      <AppText style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" color="ink3">
        {label}
      </AppText>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    flex: { flex: 1 },
    mt: { marginTop: 14 },
    mtSm: { marginTop: 10 },
    bold: { fontWeight: '700' },
    gym: { borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
    gymImage: { aspectRatio: 16 / 7, justifyContent: 'flex-end' },
    gymShade: {
      backgroundColor: 'rgba(0,0,0,0.35)',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    gymName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
    gymPlain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 20,
      padding: 14,
    },
    rest: {
      marginTop: 14,
      backgroundColor: t.colors.goodSoft,
      borderRadius: 24,
      padding: 18,
      gap: 4,
    },
    restTitle: { fontSize: 30, fontWeight: '800', color: t.colors.ink },
    weekStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    planDay: {
      alignItems: 'center',
      gap: 4,
      flex: 1,
      paddingVertical: 2,
      borderRadius: 10,
    },
    planDayToday: { backgroundColor: t.colors.amberSoft },
    planDayName: { fontWeight: '700' },
    planDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planDotOn: { backgroundColor: t.colors.ink },
    planDotRest: { backgroundColor: t.colors.goodSoft },
    planDotText: { fontSize: 12, fontWeight: '800', color: t.colors.good },
    planDotTextOn: { color: t.colors.bg },
    planEmpty: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    hero: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.colors.amber,
      borderRadius: 26,
      padding: 20,
    },
    heroTitle: {
      color: t.colors.onAmber,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginVertical: 2,
    },
    onAmber: { color: t.colors.onAmber },
    onAmberDim: { color: t.colors.onAmber, opacity: 0.8 },
    heroGo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.colors.onAmber,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    heroGoText: { color: t.colors.amber, fontWeight: '800' },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 6,
    },
    days: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    day: { alignItems: 'center', gap: 5 },
    dot: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotOn: { backgroundColor: t.colors.ink },
    dotToday: { borderWidth: 2, borderColor: t.colors.amber },
    stats: {
      flexDirection: 'row',
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: t.colors.line,
      paddingTop: 14,
    },
    stat: { flex: 1, paddingHorizontal: 6 },
    statDivider: {
      borderLeftWidth: 1,
      borderLeftColor: t.colors.line,
      paddingLeft: 12,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: t.colors.ink,
      fontVariant: ['tabular-nums'],
    },
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 26,
      marginBottom: 10,
    },
    carousel: { marginHorizontal: -18 },
    carouselBody: { paddingHorizontal: 18, gap: 10 },
    rcard: {
      width: 210,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 20,
      padding: 14,
      justifyContent: 'space-between',
    },
    rcardList: { marginTop: 4, marginBottom: 12, minHeight: 48 },
  });
