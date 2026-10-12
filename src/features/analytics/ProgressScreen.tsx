import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useServices, useSettings } from '../../app/AppContext';
import type { TabScreenProps } from '../../app/navigation/types';
import type { E1rmPoint, ExerciseRecords, LoggedExercise, WeekBucket } from '../../application/analytics/AnalyticsService';
import { BarChart, LineChart } from '../../components/charts/ProgressChart';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { Chip } from '../../components/common/Chip';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon } from '../../components/common/Icon';
import { convertWeight, roundForDisplay } from '../../domain/calculations';
import { toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatDuration, formatVolume, formatWeight } from '../../utils/format';

type Range = '30' | '90' | '365' | 'all';
const RANGES: Array<[Range, string]> = [
  ['30', '1M'],
  ['90', '3M'],
  ['365', '1Y'],
  ['all', 'All'],
];
const since = (r: Range) => (r === 'all' ? undefined : Date.now() - Number(r) * 86_400_000);
const weeksFor = (r: Range) => (r === '30' ? 5 : r === '90' ? 13 : r === '365' ? 52 : 26);

export function ProgressScreen({ navigation }: TabScreenProps<'Progress'>) {
  const services = useServices();
  const unit = useSettings(x => x.settings.weightUnit);
  const s = useStyles(styles);
  const t = useTheme();
  const [logged, setLogged] = useState<LoggedExercise[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('90');
  const [series, setSeries] = useState<E1rmPoint[]>([]);
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [records, setRecords] = useState<ExerciseRecords[]>([]);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [l, r, st] = await Promise.all([
            services.analytics.loggedExercises(),
            services.analytics.records(),
            services.analytics.weekStreak(),
          ]);
          setLogged(l);
          setRecords(r);
          setStreak(st);
          setSelected(cur => (cur && l.some(x => x.exercise.id === cur) ? cur : l[0]?.exercise.id ?? null));
        } catch (e) {
          toastError(e);
          setLogged([]);
        }
      })();
    }, [services]),
  );

  useEffect(() => {
    services.analytics.weekly(weeksFor(range)).then(setWeeks, toastError);
    if (selected) services.analytics.e1rmSeries(selected, since(range)).then(setSeries, toastError);
  }, [services, selected, range]);

  if (logged == null) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.colors.ink3} />
      </View>
    );
  }
  if (!logged.length) {
    return (
      <View style={s.screen}>
        <EmptyState
          title="Nothing to chart yet"
          message="Finish a workout and your strength, volume and records will show up here."
          actionLabel="Go to Home"
          onAction={() => navigation.navigate('Home')}
        />
      </View>
    );
  }

  const show = (kg: number) => formatWeight(kg, 'kg', unit);
  const df = (ts: number) => formatDate(ts, { day: 'numeric', month: 'short' });
  const name = logged.find(l => l.exercise.id === selected)?.exercise.name ?? '';
  const first = series[0];
  const last = series[series.length - 1];
  const change = first && last ? convertWeight(last.e1rm - first.e1rm, 'kg', unit) : 0;
  const totalWorkouts = weeks.reduce((n, w) => n + w.workouts, 0);
  const avgPerWeek = weeks.length ? totalWorkouts / weeks.length : 0;
  const totalTime = weeks.reduce((n, w) => n + w.durationMs, 0);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {logged.slice(0, 12).map(l => (
          <Chip key={l.exercise.id} label={l.exercise.name} selected={selected === l.exercise.id} onPress={() => setSelected(l.exercise.id)} />
        ))}
      </ScrollView>
      <View style={s.rangeRow} accessibilityRole="radiogroup" accessibilityLabel="Date range">
        {RANGES.map(([r, l]) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={[s.range, range === r && s.rangeOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: range === r }}
            accessibilityLabel={{ '30': 'Last month', '90': 'Last 3 months', '365': 'Last year', all: 'All time' }[r]}
          >
            <AppText variant="label" color={range === r ? 'ink' : 'ink3'}>
              {l}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Card style={s.mt}>
        <View style={s.cardHead}>
          <AppText variant="heading">Estimated 1-rep max</AppText>
          <AppText variant="caption" color="ink3" numberOfLines={1} style={s.shrink}>
            {name}, {unit}
          </AppText>
        </View>
        {series.length >= 2 ? (
          <>
            <LineChart
              points={series.map(p => ({ x: p.date, y: roundForDisplay(convertWeight(p.e1rm, 'kg', unit), 1), label: df(p.date) }))}
              accessibilityLabel={`${name}, estimated 1-rep max: ${series.map(p => `${df(p.date)} ${show(p.e1rm)} ${unit}`).join(', ')}`}
            />
            <View style={s.stats}>
              <MiniStat value={show(last.e1rm)} label={`Current, ${unit}`} />
              <MiniStat value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${formatWeight(Math.abs(change), unit, unit)}`} label="Change" good={change > 0} divider />
              <MiniStat value={String(series.length)} label="Sessions" divider />
            </View>
          </>
        ) : (
          <AppText color="ink2" style={s.mtSm}>
            Log {name || 'this exercise'} in two workouts in this range to see a trend.
          </AppText>
        )}
        <AppText variant="caption" color="ink3" style={s.mtSm}>
          Estimated from your best set each session (Epley formula, sets of 12 reps or fewer). Not a tested max.
        </AppText>
      </Card>

      <Card style={s.mt}>
        <View style={s.cardHead}>
          <AppText variant="heading">Weekly volume</AppText>
          <AppText variant="caption" color="ink3">
            {unit}
          </AppText>
        </View>
        <BarChart
          bars={weeks.map(w => ({ value: convertWeight(w.volumeKg, 'kg', unit), label: df(w.weekStart) }))}
          formatValue={v => formatVolume(v, 'kg') /* bars are already in the viewer's unit */}
          accessibilityLabel={`Weekly volume: ${weeks.map(w => `week of ${df(w.weekStart)} ${formatVolume(w.volumeKg, unit)} ${unit}`).join(', ')}`}
        />
      </Card>

      <Card style={s.mt}>
        <View style={s.cardHead}>
          <AppText variant="heading">Workouts per week</AppText>
        </View>
        <BarChart
          height={120}
          bars={weeks.map(w => ({ value: w.workouts, label: df(w.weekStart) }))}
          formatValue={v => String(v)}
          accessibilityLabel={`Workouts per week: ${weeks.map(w => `week of ${df(w.weekStart)} ${w.workouts}`).join(', ')}`}
        />
        <View style={s.stats}>
          <MiniStat value={avgPerWeek.toFixed(1)} label="Avg per week" />
          <MiniStat value={formatDuration(totalTime)} label="Time trained" divider />
          <MiniStat value={String(streak)} label="Week streak" divider />
        </View>
        <AppText variant="caption" color="ink3" style={s.mtSm}>
          A week counts toward your streak when you train at least twice.
        </AppText>
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">Personal records</AppText>
        {records.map(r => {
          const best = r.records.e1rm ?? r.records.max_weight;
          const reps = r.records.max_reps;
          return (
            <Pressable
              key={r.exercise.id}
              style={s.pr}
              onPress={() => navigation.navigate('ExerciseDetail', { id: r.exercise.id })}
              accessibilityRole="button"
            >
              <Icon name="trophy" size={20} tint="accent" />
              <View style={s.shrink}>
                <AppText variant="label">{r.exercise.name}</AppText>
                <AppText variant="caption" color="ink3">
                  {best ? `${best === r.records.e1rm ? 'Est. 1RM' : 'Heaviest'} · ${df(best.achievedAt)}` : `Most reps · ${df(reps!.achievedAt)}`}
                </AppText>
              </View>
              <AppText style={s.prValue}>{best ? `${show(best.value)} ${unit}` : `${reps?.value} reps`}</AppText>
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function MiniStat({ value, label, divider, good }: { value: string; label: string; divider?: boolean; good?: boolean }) {
  const s = useStyles(styles);
  return (
    <View style={[s.stat, divider && s.divider]}>
      <AppText style={[s.statValue, good && s.good]} numberOfLines={1} adjustsFontSizeToFit>
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
    body: { padding: 18, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
    chipRow: { marginHorizontal: -18, paddingHorizontal: 18 },
    rangeRow: {
      flexDirection: 'row',
      marginTop: 12,
      backgroundColor: t.colors.surface2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.line,
      padding: 3,
    },
    range: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
    rangeOn: { backgroundColor: t.colors.surface },
    mt: { marginTop: 14 },
    mtSm: { marginTop: 10 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 },
    shrink: { flex: 1, minWidth: 0 },
    stats: { flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: 12 },
    stat: { flex: 1, paddingHorizontal: 6 },
    divider: { borderLeftWidth: 1, borderLeftColor: t.colors.line, paddingLeft: 12 },
    statValue: { fontSize: 22, fontWeight: '800', color: t.colors.ink },
    good: { color: t.colors.good },
    pr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.colors.line },
    prValue: { fontSize: 17, fontWeight: '800', color: t.colors.ink },
  });
