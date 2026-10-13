import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useAuth, useServices, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import type { DriveOnlyHistory } from '../../application/backup/BackupService';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Sheet } from '../../components/common/Sheet';
import type { BackupWorkout } from '../../domain/backup/format';
import { summarizeBackupWorkout } from '../../domain/backup/summary';
import { DriveBackupStore } from '../../infrastructure/google-drive/DriveBackupStore';
import { useT } from '../../i18n';
import { toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatDuration, formatVolume, formatWeight } from '../../utils/format';

/**
 * Read-only view of workouts that live only in the Drive backup, usually ones
 * the "keep on this phone" setting removed. Viewing writes nothing locally.
 */
export function DriveHistoryScreen({ navigation }: RootScreenProps<'DriveHistory'>) {
  const services = useServices();
  const auth = useAuth();
  const unit = useSettings(x => x.settings.weightUnit);
  const s = useStyles(styles);
  const theme = useTheme();
  const { t, tn } = useT();
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [data, setData] = useState<DriveOnlyHistory | null>(null);
  const [open, setOpen] = useState<BackupWorkout | null>(null);
  const [reason, setReason] = useState<'connect' | 'readFailed'>('connect');

  const load = async () => {
    setState('loading');
    try {
      const account = await auth.current();
      if (!account?.driveGranted) {
        setReason('connect');
        setState('unavailable');
        return;
      }
      setData(await services.backup.driveOnlyWorkouts(new DriveBackupStore(auth)));
      setState('ready');
    } catch (e) {
      toastError(e);
      setReason('readFailed');
      setState('unavailable');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'loading') {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.colors.ink3} />
        <AppText variant="caption" color="ink3" style={s.mt}>
          {t('history.drive.reading')}
        </AppText>
      </View>
    );
  }
  if (state === 'unavailable') {
    return (
      <View style={s.screen}>
        <EmptyState
          title={t('history.drive.unavailableTitle')}
          message={t(`history.drive.${reason}`)}
          actionLabel={t('history.drive.backupSettings')}
          onAction={() => navigation.navigate('Backup')}
        />
        <Button label={t('common.retry')} variant="outline" onPress={() => void load()} style={s.retry} />
      </View>
    );
  }
  if (!data || !data.workouts.length) {
    return (
      <View style={s.screen}>
        <EmptyState title={t('history.drive.nothingTitle')} message={t('history.drive.nothingMessage')} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={s.screen}
        contentContainerStyle={s.body}
        data={data.workouts}
        keyExtractor={w => w.id}
        ListHeaderComponent={
          <AppText variant="caption" color="ink3" style={s.note}>
            {tn('history.drive.note', data.workouts.length)}
          </AppText>
        }
        renderItem={({ item }) => {
          const sum = summarizeBackupWorkout(item);
          return (
            <Pressable style={s.row} onPress={() => setOpen(item)} accessibilityRole="button">
              <View style={s.date}>
                <AppText style={s.day}>{formatDate(sum.startedAt, { day: 'numeric' })}</AppText>
                <AppText variant="caption" color="ink3">
                  {formatDate(sum.startedAt, { month: 'short', year: '2-digit' })}
                </AppText>
              </View>
              <View style={s.flex}>
                <AppText variant="label" style={s.name}>
                  {item.name}
                </AppText>
                <AppText variant="caption" color="ink3">
                  {t('history.drive.rowSummary', {
                    duration: formatDuration(sum.durationMs),
                    volume: formatVolume(sum.volumeKg, unit),
                    unit,
                    sets: sum.sets,
                  })}
                </AppText>
              </View>
            </Pressable>
          );
        }}
      />
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.name}>
        {open ? (
          <>
            <AppText color="ink2">
              {formatDate(summarizeBackupWorkout(open).startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </AppText>
            {open.exercises.map(e => (
              <View key={e.id} style={s.ex}>
                <AppText variant="label">{data.exerciseNames.get(e.exerciseId) ?? t('history.drive.exercise')}</AppText>
                {e.sets.map((set, i) => (
                  <AppText key={set.id} color="ink2" style={s.set}>
                    {set.setType === 'warmup' ? 'W' : i + 1}
                    {'  '}
                    {set.weightValue != null && set.reps != null
                      ? `${formatWeight(set.weightValue, set.weightUnit, unit)} ${unit} × ${set.reps}`
                      : set.reps != null
                        ? t('history.reps', { reps: set.reps })
                        : set.durationSeconds != null
                          ? t('history.seconds', { s: set.durationSeconds })
                          : '—'}
                  </AppText>
                ))}
              </View>
            ))}
            <Button label={t('common.done')} variant="ink" onPress={() => setOpen(null)} style={s.mt} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
    flex: { flex: 1 },
    mt: { marginTop: 12 },
    retry: { marginHorizontal: 18 },
    note: { marginBottom: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      padding: 12,
      marginBottom: 8,
    },
    date: { width: 52, alignItems: 'center', borderRightWidth: 1, borderRightColor: t.colors.line, paddingRight: 10 },
    day: { fontSize: 22, fontWeight: '800', color: t.colors.ink },
    name: { fontSize: 16, fontWeight: '700' },
    ex: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.colors.line, marginTop: 6 },
    set: { marginTop: 4 },
  });
