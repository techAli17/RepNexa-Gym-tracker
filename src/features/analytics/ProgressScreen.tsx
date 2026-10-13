import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { SkeletonCard } from '../../components/common/Skeleton';
import { convertWeight, roundForDisplay } from '../../domain/calculations';
import { useT } from '../../i18n';
import { toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatDuration, formatVolume, formatWeight } from '../../utils/format';

type Range = '30' | '90' | '365' | 'all';
const RANGES: Range[] = ['30', '90', '365', 'all'];
const since = (r: Range) => (r === 'all' ? undefined : Date.now() - Number(r) * 86_400_000);
const weeksFor = (r: Range) => (r === '30' ? 5 : r === '90' ? 13 : r === '365' ? 52 : 26);

export function ProgressScreen({ navigation }: TabScreenProps<'Progress'>) {
  const services = useServices();
  const unit = useSettings(x => x.settings.weightUnit);
  const s = useStyles(styles);
  const { t } = useT();
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
      <View style={[s.screen, s.body]}>
        <SkeletonCard height={240} />
        <SkeletonCard height={170} />
        <SkeletonCard height={150} />
      </View>
    );
  }
  if (!logged.length) {
    return (
      <View style={s.screen}>
        <EmptyState
          title={t('progress.emptyTitle')}
          message={t('progress.emptyMessage')}
          actionLabel={t('progress.goHome')}
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
      <View style={s.rangeRow} accessibilityRole="radiogroup" accessibilityLabel={t('progress.dateRange')}>
        {RANGES.map(r => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={[s.range, range === r && s.rangeOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: range === r }}
            accessibilityLabel={t(`progress.rangeA11y.${r}`)}
          >
            <AppText variant="label" color={range === r ? 'ink' : 'ink3'}>
              {t(`progress.range.${r}`)}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Card style={s.mt}>
        <View style={s.cardHead}>
          <AppText variant="heading">{t('progress.e1rmTitle')}</AppText>
          <AppText variant="caption" color="ink3" numberOfLines={1} style={s.shrink}>
            {name}, {unit}
          </AppText>
        </View>
        {series.length >= 2 ? (
          <>
            <LineChart
              points={series.map(p => ({ x: p.date, y: roundForDisplay(convertWeight(p.e1rm, 'kg', unit), 1), label: df(p.date) }))}
              accessibilityLabel={t('progress.e1rmA11y', { name, points: series.map(p => `${df(p.date)} ${show(p.e1rm)} ${unit}`).join(', ') })}
            />
            <View style={s.stats}>
              <MiniStat value={show(last.e1rm)} label={t('progress.current', { unit })} />
              <MiniStat value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${formatWeight(Math.abs(change), unit, unit)}`} label={t('progress.change')} good={change > 0} divider />
              <MiniStat value={String(series.length)} label={t('progress.sessions')} divider />
            </View>
          </>
        ) : (
          <AppText color="ink2" style={s.mtSm}>
            {t('progress.needTwo', { name: name || t('progress.thisExercise') })}
          </AppText>
        )}
        <AppText variant="caption" color="ink3" style={s.mtSm}>
          {t('progress.e1rmNote')}
        </AppText>
      </Card>

      <Card style={s.mt}>
        <View style={s.cardHead}>
          <AppText variant="heading">{t('progress.weeklyVolume')}</AppText>
          <AppText variant="caption" color="ink3">
            {unit}
          </AppText>
        </View>
        <BarChart
          bars={weeks.map(w => ({ value: convertWeight(w.volumeKg, 'kg', unit), label: df(w.weekStart) }))}
          formatValue={v => formatVolume(v, 'kg') /* bars are already in the viewer's unit */}
          accessibilityLabel={t('progress.weeklyVolumeA11y', {
            weeks: weeks.map(w => t('progress.weekOf', { date: df(w.weekStart), value: `${formatVolume(w.volumeKg, unit)} ${unit}` })).join(', '),
          })}
        />
      </Card>

      <Card style={s.mt}>
        <View style={s.cardHead}>
          <AppText variant="heading">{t('progress.workoutsPerWeek')}</AppText>
        </View>
        <BarChart
          height={120}
          bars={weeks.map(w => ({ value: w.workouts, label: df(w.weekStart) }))}
          formatValue={v => String(v)}
          accessibilityLabel={t('progress.workoutsPerWeekA11y', {
            weeks: weeks.map(w => t('progress.weekOf', { date: df(w.weekStart), value: w.workouts })).join(', '),
          })}
        />
        <View style={s.stats}>
          <MiniStat value={avgPerWeek.toFixed(1)} label={t('progress.avgPerWeek')} />
          <MiniStat value={formatDuration(totalTime)} label={t('progress.timeTrained')} divider />
          <MiniStat value={String(streak)} label={t('progress.weekStreak')} divider />
        </View>
        <AppText variant="caption" color="ink3" style={s.mtSm}>
          {t('progress.streakNote')}
        </AppText>
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">{t('progress.personalRecords')}</AppText>
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
                  {best
                    ? `${best === r.records.e1rm ? t('progress.estE1rm') : t('progress.heaviest')} · ${df(best.achievedAt)}`
                    : `${t('progress.mostReps')} · ${df(reps!.achievedAt)}`}
                </AppText>
              </View>
              <AppText style={s.prValue}>{best ? `${show(best.value)} ${unit}` : t('progress.reps', { reps: reps?.value ?? '' })}</AppText>
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
