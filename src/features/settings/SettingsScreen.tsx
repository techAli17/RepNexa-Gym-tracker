import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSettings } from '../../app/AppContext';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
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

export function SettingsScreen() {
  const settings = useSettings(s => s.settings);
  const update = useSettings(s => s.update);
  const s = useStyles(styles);
  const set = (patch: Partial<AppSettings>) => void update(patch).catch(toastError);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Card>
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
        <AppText variant="heading">Your data</AppText>
        <AppText color="ink2" style={s.note}>
          RepNexa has no servers. Your workouts are stored only on this phone.
        </AppText>
        <AppText color="ink2" style={s.note}>
          Backup to your own Google Drive and JSON export are not available yet. Until they are, deleting the app deletes your
          workout history.
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
    flex: { flex: 1 },
    setting: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.colors.line, marginTop: 8 },
    seg: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: t.colors.line, borderRadius: 12, padding: 3 },
    segBtn: { minHeight: 36, minWidth: 44, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    segOn: { backgroundColor: t.colors.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    note: { marginTop: 8 },
  });
