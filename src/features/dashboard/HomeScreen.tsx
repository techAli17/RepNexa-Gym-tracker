import React, { useCallback, useState } from 'react';
import {
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
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, w, ws, rs, st] = await Promise.all([
        services.history.list({ limit: 5 }),
        services.history.thisWeek(),
        services.analytics.weekly(8),
        services.routines.list(),
        services.analytics.weekStreak(),
      ]);
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
  const next = nextRoutine(routines, recent);
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
          accessibilityLabel={`Next up: ${next.routine.name}, ${next.exerciseNames.length} exercises`}
          accessibilityHint="Starts this routine"
        >
          <View style={s.flex}>
            <AppText variant="caption" style={s.onAmberDim}>
              Next up
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
