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
      <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel={label}>
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

function Row({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
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
  const set = (patch: Partial<AppSettings>) => void update(patch).catch(toastError);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Card>
        <AppText variant="heading">Account and backup</AppText>
        <View style={s.mtSm}>
          <BackupStatus onPress={() => navigation.navigate('Backup')} />
        </View>
        <Row
          label={account ? account.email : 'Google Drive backup'}
          detail={account ? 'Backup, restore, export and import' : 'Sign in, export and import'}
          onPress={() => navigation.navigate('Backup')}
        />
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">Workout</AppText>
        <Segmented label="Weight unit" value={settings.weightUnit} options={[['kg', 'kg'], ['lb', 'lb']]} onChange={v => set({ weightUnit: v })} />
        <Segmented
          label="Default rest"
          value={settings.defaultRestSeconds}
          options={[[60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00']]}
          onChange={v => set({ defaultRestSeconds: v })}
        />
        <AppText variant="caption" color="ink3" style={s.note}>
          Changing the unit converts what you see. Sets keep the unit they were logged in, so nothing is rounded away.
        </AppText>
        <Row label="Routines" detail="Create, edit and order your routines" onPress={() => navigation.navigate('Routines')} />
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">Appearance</AppText>
        <Segmented
          label="Theme"
          value={settings.theme}
          options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]}
          onChange={v => set({ theme: v })}
        />
      </Card>

      <Card style={s.mt}>
        <AppText variant="heading">About</AppText>
        <Row
          label="Exercise illustrations"
          detail="Not included yet"
          onPress={() =>
            Alert.alert(
              'Exercise illustrations',
              'RepNexa shows simple equipment icons for now. Licensed illustrations will be added, with their attribution listed here.',
            )
          }
        />
        <Row
          label="Privacy"
          detail="No servers, no analytics, no ads"
          onPress={() =>
            Alert.alert(
              'Privacy',
              'RepNexa has no servers and collects nothing. Workouts live on this phone and, if you turn on backup, in a file in your own Google Drive that only you control.',
            )
          }
        />
        <AppText variant="caption" color="ink3" style={s.note}>
          RepNexa {APP_VERSION}
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
    seg: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: t.colors.line, borderRadius: 12, padding: 3 },
    segBtn: { minHeight: 36, minWidth: 44, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    segOn: {
      backgroundColor: t.colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderTopWidth: 1, borderTopColor: t.colors.line, marginTop: 10 },
    note: { marginTop: 8 },
  });
