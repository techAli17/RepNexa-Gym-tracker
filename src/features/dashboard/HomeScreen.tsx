import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useActiveWorkout, useActiveWorkoutStore, useServices, useSettings } from '../../app/AppContext';
import type { TabScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ElapsedClock } from '../../components/workout/ElapsedClock';
import { WorkoutRow } from '../../components/workout/WorkoutRow';
import type { WeekSummary } from '../../application/history/HistoryService';
import { ROUTINE_TEMPLATES } from '../../data/routines/templates';
import type { RoutineTemplate, WorkoutListItem } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDuration, formatVolume } from '../../utils/format';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const services = useServices();
  const store = useActiveWorkoutStore();
  const active = useActiveWorkout(s => s.detail);
  const unit = useSettings(s => s.settings.weightUnit);
  const s = useStyles(styles);
  const [recent, setRecent] = useState<WorkoutListItem[]>([]);
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([services.history.list({ limit: 3 }), services.history.thisWeek()]);
      setRecent(r);
      setWeek(w);
    } catch (e) {
      toastError(e);
    }
  }, [services]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const start = async (template?: RoutineTemplate) => {
    if (active) {
      navigation.navigate('Workout');
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      if (template) await store.getState().startTemplate(template);
      else await store.getState().startEmpty();
      navigation.navigate('Workout');
    } catch (e) {
      toastError(e);
    } finally {
      setStarting(false);
    }
  };

  const todayIndex = (new Date().getDay() + 6) % 7;

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

      {active ? (
        <Pressable
          style={s.resume}
          onPress={() => navigation.navigate('Workout')}
          accessibilityRole="button"
          accessibilityLabel={`Resume ${active.workout.name}`}
        >
          <View style={s.flex}>
            <AppText variant="caption" style={s.onAmberDim}>
              {active.workout.pausedAt ? 'Paused workout' : 'Workout in progress'}
            </AppText>
            <AppText variant="title" style={s.onAmber} numberOfLines={1}>
              {active.workout.name}
            </AppText>
            <ElapsedClock workout={active.workout} style={s.onAmber} />
          </View>
          <View style={s.resumeGo}>
            <AppText variant="label" style={s.resumeGoText}>
              Resume
            </AppText>
          </View>
        </Pressable>
      ) : (
        <Button label={starting ? 'Starting…' : 'Start empty workout'} onPress={() => void start()} busy={starting} style={s.mt} />
      )}

      <Card style={s.mt}>
        <AppText variant="heading">This week</AppText>
        <View style={s.days} accessibilityLabel={`Trained on ${week?.activeDays.map(d => DAY_NAMES[d]).join(', ') || 'no days yet'}`}>
          {DAYS.map((d, i) => {
            const on = week?.activeDays.includes(i);
            return (
              <View key={i} style={s.day} importantForAccessibility="no-hide-descendants">
                <AppText variant="caption" color="ink3">
                  {d}
                </AppText>
                <View style={[s.dot, on && s.dotOn, i === todayIndex && s.dotToday]}>
                  {on ? <AppText style={s.dotCheck}>✓</AppText> : null}
                </View>
              </View>
            );
          })}
        </View>
        <View style={s.stats}>
          <Stat value={String(week?.workouts ?? 0)} label="Workouts" />
          <Stat value={formatDuration(week?.durationMs ?? 0)} label="Time trained" divider />
          <Stat value={formatVolume(week?.volumeKg ?? 0, unit)} label={`Volume, ${unit}`} divider />
        </View>
      </Card>

      <AppText variant="heading" style={s.section}>
        Start from a template
      </AppText>
      {ROUTINE_TEMPLATES.map(t => (
        <Pressable
          key={t.key}
          style={({ pressed }) => [s.template, pressed && s.pressed]}
          onPress={() => void start(t)}
          disabled={starting}
          accessibilityRole="button"
          accessibilityLabel={`Start ${t.name}. ${t.description}. ${t.exercises.length} exercises.`}
        >
          <View style={s.flex}>
            <AppText variant="label" style={s.templateName}>
              {t.name}
            </AppText>
            <AppText variant="caption" color="ink3">
              {t.description} · {t.exercises.length} exercises
            </AppText>
          </View>
          <AppText variant="label" color="accent">
            Start
          </AppText>
        </Pressable>
      ))}

      <View style={s.sectionRow}>
        <AppText variant="heading">Recent workouts</AppText>
        {recent.length ? (
          <Pressable onPress={() => navigation.navigate('History')} accessibilityRole="link" hitSlop={10}>
            <AppText variant="label" color="accent">
              See all
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {recent.length ? (
        recent.map(r => (
          <WorkoutRow key={r.workout.id} item={r} unit={unit} onPress={id => navigation.navigate('WorkoutDetail', { id })} />
        ))
      ) : (
        <AppText color="ink2">Your finished workouts will show up here.</AppText>
      )}
    </ScrollView>
  );
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
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
    resume: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.colors.amber,
      borderRadius: 24,
      padding: 18,
    },
    onAmber: { color: t.colors.onAmber },
    onAmberDim: { color: t.colors.onAmber, opacity: 0.8 },
    resumeGo: { backgroundColor: t.colors.onAmber, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
    resumeGoText: { color: t.colors.amber, fontWeight: '800' },
    days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
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
    dotCheck: { color: t.colors.bg, fontWeight: '800' },
    stats: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: 14 },
    stat: { flex: 1, paddingHorizontal: 6 },
    statDivider: { borderLeftWidth: 1, borderLeftColor: t.colors.line, paddingLeft: 12 },
    statValue: { fontSize: 22, fontWeight: '800', color: t.colors.ink, fontVariant: ['tabular-nums'] },
    section: { marginTop: 26, marginBottom: 10 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 10 },
    template: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 8,
      minHeight: 60,
    },
    templateName: { fontSize: 17, fontWeight: '800' },
    pressed: { opacity: 0.85 },
  });
