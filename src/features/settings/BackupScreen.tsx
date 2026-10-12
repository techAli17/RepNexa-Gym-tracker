import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useAccountActions, useActiveWorkoutStore, useAuth, useBackupStatus, useScheduler, useServices, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import type { ImportPreview } from '../../application/backup/BackupService';
import { DriveBackupStore } from '../../infrastructure/google-drive/DriveBackupStore';
import { pickJsonFile, shareJsonFile } from '../../infrastructure/import-export/FileTransfer';
import { AppText } from '../../components/common/AppText';
import { BackupStatus } from '../../components/common/BackupStatus';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ChoiceChips } from '../../components/common/FormControls';
import { Icon } from '../../components/common/Icon';
import { toast, toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate } from '../../utils/format';

const RETENTION: ReadonlyArray<readonly [string, string]> = [
  ['all', 'Keep all'],
  ['24', '2 years'],
  ['12', '1 year'],
  ['6', '6 months'],
];

function describePreview(p: ImportPreview): string {
  const s = p.stats;
  if (p.noChanges) return 'Everything in this backup is already on this phone (or newer here). Nothing will change.';
  const parts = [
    s.workoutsAdded && `${s.workoutsAdded} new ${s.workoutsAdded === 1 ? 'workout' : 'workouts'}`,
    s.workoutsUpdated && `${s.workoutsUpdated} updated`,
    s.workoutsDeleted && `${s.workoutsDeleted} deleted (they were deleted on another device)`,
    s.routinesChanged && `${s.routinesChanged} ${s.routinesChanged === 1 ? 'routine' : 'routines'}`,
    s.exercisesChanged && `${s.exercisesChanged} ${s.exercisesChanged === 1 ? 'exercise' : 'exercises'}`,
  ].filter(Boolean);
  const kept = s.keptLocal ? ` ${s.keptLocal} newer ${s.keptLocal === 1 ? 'item' : 'items'} on this phone will be kept.` : '';
  return `This will add or update: ${parts.join(', ')}.${kept} Nothing on this phone is removed unless it was deleted elsewhere later.`;
}

export function BackupScreen(_: RootScreenProps<'Backup'>) {
  const services = useServices();
  const actions = useAccountActions();
  const scheduler = useScheduler();
  const auth = useAuth();
  const store = useActiveWorkoutStore();
  const state = useBackupStatus(x => x);
  const settings = useSettings(x => x.settings);
  const update = useSettings(x => x.update);
  const s = useStyles(styles);
  const t = useTheme();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  /** Shows what a backup would change, and applies it only after the user agrees. */
  const confirmImport = (preview: ImportPreview, source: string) => {
    Alert.alert(`Restore from ${source}?`, describePreview(preview), [
      { text: 'Cancel', style: 'cancel' },
      ...(preview.noChanges
        ? []
        : [
            {
              text: 'Restore',
              onPress: () =>
                void run('apply', async () => {
                  await services.backup.applyImport(preview.file);
                  await store.getState().load();
                  toast('Restore complete');
                }),
            },
          ]),
    ]);
  };

  const account = state.account;
  const signedIn = !!account;
  const driveOn = !!account?.driveGranted;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <BackupStatus />

      <Card style={s.mt}>
        <AppText variant="heading">Google account</AppText>
        {state.phase === 'notConfigured' ? (
          <AppText color="ink2" style={s.p}>
            Google sign-in is not set up in this build, so backups to Drive are unavailable. Your workouts are saved on this phone,
            and you can still export them as a file below.
          </AppText>
        ) : signedIn ? (
          <>
            <View style={s.acct}>
              <View style={s.avatar}>
                <AppText style={s.avatarText}>{(account.name ?? account.email).charAt(0).toUpperCase()}</AppText>
              </View>
              <View style={s.flex}>
                <AppText variant="label">{account.name ?? account.email}</AppText>
                <AppText variant="caption" color="ink3">
                  {account.email}
                </AppText>
              </View>
            </View>
            <Button label="Sign out" variant="outline" onPress={() => void run('signout', actions.signOut)} busy={busy === 'signout'} />
          </>
        ) : (
          <>
            <AppText color="ink2" style={s.p}>
              Sign in to back up to your own Google Drive. RepNexa has no servers; your workouts never go anywhere else.
            </AppText>
            <Button label="Sign in with Google" variant="ink" onPress={() => void run('signin', actions.signIn)} busy={busy === 'signin'} />
          </>
        )}
      </Card>

      {signedIn ? (
        <Card style={s.mt}>
          <AppText variant="heading">Drive backup</AppText>
          {driveOn ? (
            <>
              <View style={s.row}>
                <AppText color="ink3" style={s.flex}>
                  Last successful backup
                </AppText>
                <AppText variant="label">
                  {state.lastSuccessAt
                    ? formatDate(state.lastSuccessAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                    : 'Never'}
                </AppText>
              </View>
              <View style={s.row}>
                <AppText style={s.flex}>Back up automatically</AppText>
                <Switch
                  value={settings.autoBackup}
                  onValueChange={v => void update({ autoBackup: v }).then(() => scheduler.refresh())}
                  trackColor={{ true: t.colors.amber, false: t.colors.raise }}
                  accessibilityLabel="Back up automatically"
                />
              </View>
              <Button
                label={state.phase === 'running' ? 'Backing up…' : 'Back up now'}
                variant="ink"
                busy={busy === 'now' || state.phase === 'running'}
                onPress={() =>
                  void run('now', async () => {
                    const out = await scheduler.runNow();
                    const st = scheduler.getState();
                    if (st.phase === 'idle' && out) toast(out.status === 'upToDate' ? 'Already up to date' : 'Backup uploaded and verified');
                  })
                }
              />
              <Button
                label="Restore from Drive"
                variant="outline"
                style={s.mtSm}
                busy={busy === 'restore'}
                onPress={() =>
                  void run('restore', async () => {
                    const preview = await services.backup.previewRemote(new DriveBackupStore(auth));
                    if (!preview) toast('No backup found in your Drive yet');
                    else confirmImport(preview, 'Drive');
                  })
                }
              />
              <AppText variant="caption" color="ink3" style={s.p}>
                Backups go to the RepNexa folder in your Drive as RepNexa-Backup.json. RepNexa can see only files it created there,
                nothing else in your Drive.
              </AppText>
            </>
          ) : (
            <>
              <AppText color="ink2" style={s.p}>
                {state.error
                  ? 'RepNexa can no longer write to your Drive. Allow access again to resume backups.'
                  : 'Allow RepNexa to create its backup file in your Drive. It cannot see your other files.'}
              </AppText>
              <Button label="Allow Drive backup" variant="ink" onPress={() => void run('drive', actions.connectDrive)} busy={busy === 'drive'} />
            </>
          )}
        </Card>
      ) : null}

      <Card style={s.mt}>
        <AppText variant="heading">History on this phone</AppText>
        <AppText color="ink2" style={s.p}>
          Older workouts can be removed from this phone to save space. Each one is removed only after a verified Drive backup
          holds it, and it stays in Drive.
        </AppText>
        <ChoiceChips
          label="Keep workouts on this phone"
          value={settings.localRetentionMonths == null ? 'all' : String(settings.localRetentionMonths)}
          options={RETENTION}
          onChange={v => {
            const months = v === 'all' ? null : Number(v);
            if (months != null && !driveOn) {
              Alert.alert('Drive backup is off', 'Nothing will be removed until a verified Drive backup holds it.');
            }
            void update({ localRetentionMonths: months }).catch(toastError);
          }}
        />
        <AppText variant="caption" color="ink3" style={s.p}>
          Removing workouts from RepNexa cannot erase copies in your phone’s own system backups or files you exported.
        </AppText>
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">Export and import</AppText>
        <AppText color="ink2" style={s.p}>
          A JSON file with all your workouts, routines and custom exercises. Keep it anywhere you like.
        </AppText>
        <View style={s.pair}>
          <Button
            label="Export"
            variant="outline"
            style={s.flex}
            busy={busy === 'export'}
            onPress={() =>
              void run('export', async () => {
                const { json, fileName } = await services.backup.exportJson();
                await shareJsonFile(json, fileName);
              })
            }
          />
          <Button
            label="Import"
            variant="outline"
            style={s.flex}
            busy={busy === 'import'}
            onPress={() =>
              void run('import', async () => {
                const text = await pickJsonFile();
                if (text == null) return;
                confirmImport(await services.backup.previewImport(text), 'this file');
              })
            }
          />
        </View>
      </Card>

      <Card style={s.mt}>
        <View style={s.note}>
          <Icon name="shield" size={20} tint="good" />
          <AppText color="ink2" style={s.flex}>
            RepNexa has no servers. Your workouts are stored only on this phone and, if you turn it on, in your own Google Drive.
          </AppText>
        </View>
        {signedIn ? (
          <Button
            label="Remove RepNexa’s access to Google"
            variant="dangerText"
            onPress={() =>
              Alert.alert('Remove access?', 'Backups stop. Your Drive file and the data on this phone are kept.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => void run('revoke', actions.disconnect) },
              ])
            }
          />
        ) : null}
        <Button
          label="Delete data on this phone"
          variant="dangerText"
          onPress={() =>
            Alert.alert(
              'Delete data on this phone?',
              state.pending || !state.lastSuccessAt
                ? 'Some workouts are NOT in a backup. They will be gone for good. Export them first if you want to keep them.'
                : 'Your Drive backup is kept and can be restored later.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void run('wipe', actions.wipeLocal) },
              ],
            )
          }
        />
      </Card>
    </ScrollView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 48 },
    flex: { flex: 1 },
    mt: { marginTop: 14 },
    mtSm: { marginTop: 8 },
    p: { marginTop: 8, marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderTopWidth: 1, borderTopColor: t.colors.line, marginBottom: 6 },
    acct: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.ink, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: t.colors.bg, fontWeight: '800', fontSize: 18 },
    pair: { flexDirection: 'row', gap: 8 },
    note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 6 },
  });
