import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useBackupStatus, useSettings } from '../../app/AppContext';
import type { TabScreenProps } from '../../app/navigation/types';
import { APP_VERSION } from '../../application/container';
import { AppText } from '../../components/common/AppText';
import { BackupStatus } from '../../components/common/BackupStatus';
import { Card } from '../../components/common/Card';
import { Icon } from '../../components/common/Icon';
import type { AppSettings } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useT } from '../../i18n';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  const s = useStyles(styles);
  return (
    <View style={s.setting}>
      <AppText style={s.flex}>{label}</AppText>
      <View
        style={s.seg}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map(([v, l]) => {
          const on = v === value;
          return (
            <Pressable
              key={String(v)}
              onPress={() => onChange(v)}
              style={[s.segBtn, on && s.segOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={l}
            >
              <AppText variant="label" color={on ? 'ink' : 'ink3'}>
                {l}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Row({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  const s = useStyles(styles);
  return (
    <Pressable style={s.row} onPress={onPress} accessibilityRole="button">
      <View style={s.flex}>
        <AppText>{label}</AppText>
        {detail ? (
          <AppText variant="caption" color="ink3">
            {detail}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevronRight" size={18} tint="ink3" />
    </Pressable>
  );
}

export function SettingsScreen({ navigation }: TabScreenProps<'Settings'>) {
  const settings = useSettings(s => s.settings);
  const update = useSettings(s => s.update);
  const account = useBackupStatus(s => s.account);
  const s = useStyles(styles);
  const { t } = useT();
  const set = (patch: Partial<AppSettings>) =>
    void update(patch).catch(toastError);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Card>
        <AppText variant="heading">{t('settings.accountAndBackup')}</AppText>
        <View style={s.mtSm}>
          <BackupStatus onPress={() => navigation.navigate('Backup')} />
        </View>
        <Row
          label={account ? account.email : t('settings.driveBackup')}
          detail={
            account
              ? t('settings.accountDetail')
              : t('settings.signedOutDetail')
          }
          onPress={() => navigation.navigate('Backup')}
        />
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">{t('settings.workout')}</AppText>
        <Segmented
          label={t('settings.weightUnit')}
          value={settings.weightUnit}
          options={[
            ['kg', 'kg'],
            ['lb', 'lb'],
          ]}
          onChange={v => set({ weightUnit: v })}
        />
        <Segmented
          label={t('settings.defaultRest')}
          value={settings.defaultRestSeconds}
          options={[
            [60, '1:00'],
            [90, '1:30'],
            [120, '2:00'],
            [180, '3:00'],
          ]}
          onChange={v => set({ defaultRestSeconds: v })}
        />
        <AppText variant="caption" color="ink3" style={s.note}>
          {t('settings.unitNote')}
        </AppText>
        <Row
          label={t('settings.routines')}
          detail={t('settings.routinesDetail')}
          onPress={() => navigation.navigate('Routines')}
        />
        <Row
          label={t('settings.weekPlan')}
          detail={t('settings.weekPlanDetail')}
          onPress={() => navigation.navigate('WeekPlan')}
        />
        <Row
          label={t('settings.gym')}
          detail={
            settings.gymName
              ? settings.gymPhotoFile
                ? t('settings.gymWithPhoto', { name: settings.gymName })
                : settings.gymName
              : t('settings.gymDetail')
          }
          onPress={() => navigation.navigate('GymProfile')}
        />
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">{t('settings.appearance')}</AppText>
        <Segmented
          label={t('settings.theme')}
          value={settings.theme}
          options={[
            ['system', t('settings.themeSystem')],
            ['light', t('settings.themeLight')],
            ['dark', t('settings.themeDark')],
          ]}
          onChange={v => set({ theme: v })}
        />
        <Segmented
          label={t('common.language.label')}
          value={settings.language}
          options={[
            ['system', t('common.language.system')],
            ['en', t('common.language.en')],
            ['hi', t('common.language.hi')],
          ]}
          onChange={v => set({ language: v })}
        />
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">{t('settings.about')}</AppText>
        <Row
          label={t('settings.illustrations')}
          detail={t('settings.illustrationsDetail')}
          onPress={() =>
            Alert.alert(
              t('settings.illustrations'),
              t('settings.illustrationsMessage'),
            )
          }
        />
        <Row
          label={t('settings.privacy')}
          detail={t('settings.privacyDetail')}
          onPress={() =>
            Alert.alert(
              t('settings.privacy'),
              t('settings.privacyMessage'),
            )
          }
        />
        <AppText variant="caption" color="ink3" style={s.note}>
          {t('settings.version', { version: APP_VERSION })}
        </AppText>
      </Card>
    </ScrollView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    mt: { marginTop: 14 },
    mtSm: { marginTop: 10 },
    flex: { flex: 1 },
    setting: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: t.colors.line,
      marginTop: 8,
    },
    seg: {
      flexDirection: 'row',
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 12,
      padding: 3,
    },
    segBtn: {
      minHeight: 36,
      minWidth: 44,
      paddingHorizontal: 10,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segOn: {
      backgroundColor: t.colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      borderTopWidth: 1,
      borderTopColor: t.colors.line,
      marginTop: 10,
    },
    note: { marginTop: 8 },
  });
