import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
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
import { useT } from '../../i18n';
import { toast, toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate } from '../../utils/format';

type I18n = Pick<ReturnType<typeof useT>, 't' | 'tn'>;

function describePreview(p: ImportPreview, { t, tn }: I18n): string {
  const s = p.stats;
  if (p.noChanges) return t('backup.preview.noChanges');
  const parts = [
    s.workoutsAdded && tn('backup.preview.newWorkouts', s.workoutsAdded),
    s.workoutsUpdated && t('backup.preview.updated', { count: s.workoutsUpdated }),
    s.workoutsDeleted && t('backup.preview.deleted', { count: s.workoutsDeleted }),
    s.routinesChanged && tn('backup.preview.routines', s.routinesChanged),
    s.exercisesChanged && tn('backup.preview.exercises', s.exercisesChanged),
  ].filter(Boolean);
  const kept = s.keptLocal ? ` ${tn('backup.preview.kept', s.keptLocal)}` : '';
  return t('backup.preview.summary', { parts: parts.join(t('backup.preview.separator')), kept });
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
  const theme = useTheme();
  const i18n = useT();
  const { t } = i18n;
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
  const confirmImport = (preview: ImportPreview, title: string) => {
    Alert.alert(title, describePreview(preview, i18n), [
      { text: t('common.cancel'), style: 'cancel' },
      ...(preview.noChanges
        ? []
        : [
            {
              text: t('backup.restore'),
              onPress: () =>
                void run('apply', async () => {
                  await services.backup.applyImport(preview.file);
                  await store.getState().load();
                  toast(t('backup.restoreComplete'));
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
        <AppText variant="heading">{t('backup.googleAccount')}</AppText>
        {state.phase === 'notConfigured' ? (
          <AppText color="ink2" style={s.p}>
            {t('backup.notConfigured')}
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
            <Button label={t('backup.signOut')} variant="outline" onPress={() => void run('signout', actions.signOut)} busy={busy === 'signout'} />
          </>
        ) : (
          <>
            <AppText color="ink2" style={s.p}>
              {t('backup.signInIntro')}
            </AppText>
            <Button label={t('backup.signIn')} variant="ink" onPress={() => void run('signin', actions.signIn)} busy={busy === 'signin'} />
          </>
        )}
      </Card>

      {signedIn ? (
        <Card style={s.mt}>
          <AppText variant="heading">{t('backup.driveBackup')}</AppText>
          {driveOn ? (
            <>
              <View style={s.row}>
                <AppText color="ink3" style={s.flex}>
                  {t('backup.lastSuccess')}
                </AppText>
                <AppText variant="label">
                  {state.lastSuccessAt
                    ? formatDate(state.lastSuccessAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                    : t('backup.never')}
                </AppText>
              </View>
              <View style={s.row}>
                <AppText style={s.flex}>{t('backup.auto')}</AppText>
                <Switch
                  value={settings.autoBackup}
                  onValueChange={v => void update({ autoBackup: v }).then(() => scheduler.refresh())}
                  trackColor={{ true: theme.colors.amber, false: theme.colors.raise }}
                  accessibilityLabel={t('backup.auto')}
                />
              </View>
              <Button
                label={state.phase === 'running' ? t('backup.backingUp') : t('backup.backUpNow')}
                variant="ink"
                busy={busy === 'now' || state.phase === 'running'}
                onPress={() =>
                  void run('now', async () => {
                    const out = await scheduler.runNow();
                    const st = scheduler.getState();
                    if (st.phase === 'idle' && out) toast(out.status === 'upToDate' ? t('backup.upToDate') : t('backup.uploaded'));
                  })
                }
              />
              <Button
                label={t('backup.restoreDrive')}
                variant="outline"
                style={s.mtSm}
                busy={busy === 'restore'}
                onPress={() =>
                  void run('restore', async () => {
                    const preview = await services.backup.previewRemote(new DriveBackupStore(auth));
                    if (!preview) toast(t('backup.noRemote'));
                    else confirmImport(preview, t('backup.restoreFromDrive'));
                  })
                }
              />
              <AppText variant="caption" color="ink3" style={s.p}>
                {t('backup.driveNote')}
              </AppText>
            </>
          ) : (
            <>
              <AppText color="ink2" style={s.p}>
                {state.error
                  ? t('backup.driveLost')
                  : t('backup.driveAsk')}
              </AppText>
              <Button label={t('backup.allowDrive')} variant="ink" onPress={() => void run('drive', actions.connectDrive)} busy={busy === 'drive'} />
            </>
          )}
        </Card>
      ) : null}

      <Card style={s.mt}>
        <AppText variant="heading">{t('backup.whereKept')}</AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('backup.whereKept')}>
          <PolicyOption
            title={t('backup.phoneAndDrive')}
            tag={t('backup.recommended')}
            body={t('backup.phoneAndDriveBody')}
            selected={settings.storagePolicy !== 'drive_only'}
            onPress={() => void update({ storagePolicy: 'phone_and_drive' }).then(() => scheduler.refresh(), toastError)}
          />
          <PolicyOption
            title={t('backup.driveOnly')}
            body={t('backup.driveOnlyBody')}
            selected={settings.storagePolicy === 'drive_only'}
            onPress={() => {
              if (settings.storagePolicy === 'drive_only') return;
              if (!driveOn) {
                Alert.alert(t('backup.connectFirst'), t('backup.connectFirstMessage'));
                return;
              }
              Alert.alert(
                t('backup.driveOnlyTitle'),
                t('backup.driveOnlyMessage'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('backup.useDriveOnly'),
                    onPress: () =>
                      void update({ storagePolicy: 'drive_only' }).then(async () => {
                        await scheduler.refresh();
                        void scheduler.runNow();
                      }, toastError),
                  },
                ],
              );
            }}
          />
        </View>
      </Card>

      {settings.storagePolicy === 'drive_only' ? null : (
      <Card style={s.mt}>
        <AppText variant="heading">{t('backup.historyOnPhone')}</AppText>
        <AppText color="ink2" style={s.p}>
          {t('backup.historyOnPhoneBody')}
        </AppText>
        <ChoiceChips
          label={t('backup.keepOnPhone')}
          value={settings.localRetentionMonths == null ? 'all' : String(settings.localRetentionMonths)}
          options={[
            ['all', t('backup.retention.all')],
            ['24', t('backup.retention.years2')],
            ['12', t('backup.retention.year1')],
            ['6', t('backup.retention.months6')],
          ]}
          onChange={v => {
            const months = v === 'all' ? null : Number(v);
            if (months != null && !driveOn) {
              Alert.alert(t('backup.driveOff'), t('backup.driveOffMessage'));
            }
            void update({ localRetentionMonths: months }).catch(toastError);
          }}
        />
        <AppText variant="caption" color="ink3" style={s.p}>
          {t('backup.systemBackupsNote')}
        </AppText>
      </Card>
      )}

      <Card style={s.mt}>
        <AppText variant="heading">{t('backup.exportImport')}</AppText>
        <AppText color="ink2" style={s.p}>
          {t('backup.exportImportBody')}
        </AppText>
        <View style={s.pair}>
          <Button
            label={t('backup.export')}
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
            label={t('backup.import')}
            variant="outline"
            style={s.flex}
            busy={busy === 'import'}
            onPress={() =>
              void run('import', async () => {
                const text = await pickJsonFile();
                if (text == null) return;
                confirmImport(await services.backup.previewImport(text), t('backup.restoreFromFile'));
              })
            }
          />
        </View>
      </Card>

      <Card style={s.mt}>
        <View style={s.note}>
          <Icon name="shield" size={20} tint="good" />
          <AppText color="ink2" style={s.flex}>
            {t('backup.privacyNote')}
          </AppText>
        </View>
        {signedIn ? (
          <Button
            label={t('backup.removeAccess')}
            variant="dangerText"
            onPress={() =>
              Alert.alert(t('backup.removeAccessTitle'), t('backup.removeAccessMessage'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.remove'), style: 'destructive', onPress: () => void run('revoke', actions.disconnect) },
              ])
            }
          />
        ) : null}
        <Button
          label={t('backup.deleteLocal')}
          variant="dangerText"
          onPress={() =>
            Alert.alert(
              t('backup.deleteLocalTitle'),
              state.pending || !state.lastSuccessAt
                ? t('backup.deleteLocalUnsaved')
                : t('backup.deleteLocalSaved'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: () => void run('wipe', actions.wipeLocal) },
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
    policy: {
      flexDirection: 'row',
      gap: 12,
      borderWidth: 1.5,
      borderColor: t.colors.line,
      borderRadius: 16,
      padding: 14,
      marginTop: 10,
    },
    policyOn: { borderColor: t.colors.amber },
    policyBody: { marginTop: 3 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.colors.ink3, marginTop: 1 },
    radioOn: { borderColor: t.colors.amber, backgroundColor: t.colors.amber },
  });

function PolicyOption({
  title,
  tag,
  body,
  selected,
  onPress,
}: {
  title: string;
  tag?: string;
  body: string;
  selected: boolean;
  onPress: () => void;
}) {
  const s = useStyles(styles);
  return (
    <Pressable
      style={[s.policy, selected && s.policyOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${body}`}
    >
      <View style={[s.radio, selected && s.radioOn]} />
      <View style={s.flex}>
        <AppText variant="label">
          {title}
          {tag ? <AppText variant="caption" color="accent">{`  ${tag}`}</AppText> : null}
        </AppText>
        <AppText variant="caption" color="ink2" style={s.policyBody}>
          {body}
        </AppText>
      </View>
    </Pressable>
  );
}
