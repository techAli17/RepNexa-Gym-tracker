import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useServices, useSettings } from '../../app/AppContext';
import type { TabScreenProps } from '../../app/navigation/types';
import type { LoggedExercise } from '../../application/analytics/AnalyticsService';
import { AppText } from '../../components/common/AppText';
import { Chip } from '../../components/common/Chip';
import { EmptyState } from '../../components/common/EmptyState';
import { Sheet } from '../../components/common/Sheet';
import { WorkoutRow } from '../../components/workout/WorkoutRow';
import type { WorkoutListItem } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate } from '../../utils/format';

const PAGE = 30;
type Range = 'all' | '30' | '90' | 'year';
const RANGES: Array<[Range, string]> = [
  ['all', 'All time'],
  ['30', '30 days'],
  ['90', '90 days'],
  ['year', 'This year'],
];

function rangeStart(r: Range): number | undefined {
  if (r === 'all') return undefined;
  if (r === 'year') return new Date(new Date().getFullYear(), 0, 1).getTime();
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Number(r));
  return d.getTime();
}

type Row = { kind: 'month'; key: string; label: string } | { kind: 'workout'; key: string; item: WorkoutListItem };

/** Groups the flat list under month headings. */
function withMonths(items: readonly WorkoutListItem[]): Row[] {
  const out: Row[] = [];
  let cur = '';
  for (const it of items) {
    const m = formatDate(it.workout.startedAt, { month: 'long', year: 'numeric' });
    if (m !== cur) {
      cur = m;
      out.push({ kind: 'month', key: `m:${m}`, label: m });
    }
    out.push({ kind: 'workout', key: it.workout.id, item: it });
  }
  return out;
}

export function HistoryScreen({ navigation }: TabScreenProps<'History'>) {
  const services = useServices();
  const unit = useSettings(s => s.settings.weightUnit);
  const s = useStyles(styles);
  const t = useTheme();
  const [items, setItems] = useState<WorkoutListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [range, setRange] = useState<Range>('all');
  const [exercise, setExercise] = useState<LoggedExercise['exercise'] | null>(null);
  const [picking, setPicking] = useState(false);
  const [logged, setLogged] = useState<LoggedExercise[]>([]);
  const done = useRef(false);

  const query = useCallback(
    (startedBefore?: number) =>
      services.history.list({ limit: PAGE, startedBefore, startedAfter: rangeStart(range), exerciseId: exercise?.id }),
    [services, range, exercise],
  );

  const reload = useCallback(async () => {
    try {
      const first = await query();
      done.current = first.length < PAGE;
      setItems(first);
    } catch (e) {
      toastError(e);
      setItems(prev => prev ?? []);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const loadMore = async () => {
    if (!items?.length || done.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await query(items[items.length - 1].workout.startedAt);
      done.current = next.length < PAGE;
      setItems(cur => [...(cur ?? []), ...next]);
    } catch (e) {
      toastError(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const openPicker = () => {
    setPicking(true);
    services.analytics.loggedExercises().then(setLogged, toastError);
  };

  const open = useCallback((id: string) => navigation.navigate('WorkoutDetail', { id }), [navigation]);
  const filtered = range !== 'all' || exercise != null;

  const header = (
    <View style={s.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {RANGES.map(([r, l]) => (
          <Chip key={r} label={l} selected={range === r} onPress={() => setRange(r)} />
        ))}
      </ScrollView>
      <Pressable
        style={[s.exFilter, exercise && s.exFilterOn]}
        onPress={exercise ? () => setExercise(null) : openPicker}
        accessibilityRole="button"
        accessibilityLabel={exercise ? `Filtered by ${exercise.name}. Clear filter` : 'Filter by exercise'}
      >
        <AppText variant="label" color={exercise ? 'bg' : 'ink2'}>
          {exercise ? `${exercise.name}  ✕` : 'Filter by exercise'}
        </AppText>
      </Pressable>
    </View>
  );

  if (items == null) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.colors.ink3} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={s.screen}
        contentContainerStyle={s.body}
        data={withMonths(items)}
        keyExtractor={r => r.key}
        renderItem={({ item }) =>
          item.kind === 'month' ? (
            <AppText variant="label" color="ink3" style={s.month} accessibilityRole="header">
              {item.label}
            </AppText>
          ) : (
            <WorkoutRow item={item.item} unit={unit} onPress={open} />
          )
        }
        ListHeaderComponent={header}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        initialNumToRender={14}
        windowSize={7}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={s.more} color={t.colors.ink3} /> : undefined}
        ListEmptyComponent={
          filtered ? (
            <EmptyState title="No workouts match" message="Try a wider date range or another exercise." />
          ) : (
            <EmptyState
              title="No workouts yet"
              message="Your finished workouts will show up here."
              actionLabel="Go to Home"
              onAction={() => navigation.navigate('Home')}
            />
          )
        }
      />
      <Sheet visible={picking} onClose={() => setPicking(false)} title="Filter by exercise">
        {logged.length ? (
          logged.map(l => (
            <Pressable
              key={l.exercise.id}
              style={s.pickRow}
              onPress={() => {
                setExercise(l.exercise);
                setPicking(false);
              }}
              accessibilityRole="button"
            >
              <AppText style={s.flex}>{l.exercise.name}</AppText>
              <AppText variant="caption" color="ink3">
                {l.workoutCount} {l.workoutCount === 1 ? 'workout' : 'workouts'}
              </AppText>
            </Pressable>
          ))
        ) : (
          <AppText color="ink2">Exercises you have logged will appear here.</AppText>
        )}
      </Sheet>
    </>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40, flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
    more: { marginVertical: 16 },
    flex: { flex: 1 },
    filters: { marginBottom: 4 },
    chipRow: { marginHorizontal: -18, paddingHorizontal: 18 },
    exFilter: {
      alignSelf: 'flex-start',
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: t.colors.line,
      marginTop: 10,
    },
    exFilterOn: { backgroundColor: t.colors.ink, borderColor: t.colors.ink, borderStyle: 'solid' },
    month: { marginTop: 18, marginBottom: 8 },
    pickRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 1, borderBottomColor: t.colors.line },
  });
