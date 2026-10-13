import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveWorkout, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { useT } from '../../i18n';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDuration, formatVolume, formatWeight } from '../../utils/format';

export function WorkoutSummaryScreen({ navigation }: RootScreenProps<'WorkoutSummary'>) {
  const summary = useActiveWorkout(s => s.lastSummary);
  const unit = useSettings(s => s.settings.weightUnit);
  const insets = useSafeAreaInsets();
  const s = useStyles(styles);
  const { t } = useT();

  useEffect(() => {
    if (!summary) navigation.goBack();
  }, [summary, navigation]);
  if (!summary) return null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}>
      <AppText variant="title" style={s.center} accessibilityRole="header">
        {t('workout.summary.complete')}
      </AppText>
      <AppText color="ink2" style={s.center}>
        {summary.detail.workout.name}
      </AppText>
      <AppText style={[s.center, s.big]}>{formatDuration(summary.durationMs)}</AppText>

      <View style={s.grid}>
        <Stat value={formatVolume(summary.volumeKg, unit)} label={t('workout.volumeUnit', { unit })} />
        <Stat value={String(summary.completedSets)} label={t('workout.setsDone')} divider />
        <Stat value={String(summary.improvements.length)} label={t('workout.summary.records')} divider />
      </View>

      <AppText variant="heading" style={s.h}>
        {t('workout.summary.personalRecords')}
      </AppText>
      {summary.improvements.length ? (
        summary.improvements.map(i => (
          <View key={`${i.exerciseId}:${i.recordType}`} style={s.pr}>
            <View style={s.prText}>
              <AppText variant="label">{i.exerciseName}</AppText>
              <AppText variant="caption" color="ink3">
                {t(`workout.summary.record.${i.recordType}`)}
              </AppText>
            </View>
            <AppText variant="number" color="accent">
              {i.recordType === 'max_reps' ? i.current : `${formatWeight(i.current, 'kg', unit)} ${unit}`}
            </AppText>
          </View>
        ))
      ) : (
        <AppText color="ink2">{t('workout.summary.noRecords')}</AppText>
      )}

      <AppText variant="caption" color="ink3" style={s.saved}>
        {t('workout.summary.saved')}
      </AppText>
      <Button label={t('common.done')} variant="ink" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  const s = useStyles(styles);
  return (
    <View style={[s.stat, divider && s.divider]}>
      <AppText variant="number">{value}</AppText>
      <AppText variant="caption" color="ink3">
        {label}
      </AppText>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.surface },
    body: { padding: 20, paddingTop: 28 },
    center: { textAlign: 'center' },
    big: { fontSize: 52, fontWeight: '800', marginTop: 6, color: t.colors.ink, fontVariant: ['tabular-nums'] },
    grid: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: 18, paddingVertical: 12, marginVertical: 18 },
    stat: { flex: 1, alignItems: 'center' },
    divider: { borderLeftWidth: 1, borderLeftColor: t.colors.line },
    h: { marginBottom: 6 },
    pr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.colors.line },
    prText: { flex: 1 },
    saved: { marginTop: 18, marginBottom: 12 },
  });
