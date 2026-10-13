import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '../../i18n';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from '../common/AppText';
import { Sheet } from '../common/Sheet';

const OPTIONS: Array<[number | null, string]> = [
  [null, 'default'],
  [0, 'off'],
  [30, '0:30'],
  [60, '1:00'],
  [90, '1:30'],
  [120, '2:00'],
  [150, '2:30'],
  [180, '3:00'],
  [240, '4:00'],
  [300, '5:00'],
];

/** Rest after each set of one exercise. "Default" follows the setting in Settings. */
export function RestPickerSheet({
  visible,
  current,
  defaultSeconds,
  onClose,
  onPick,
}: {
  visible: boolean;
  current: number | null;
  defaultSeconds: number;
  onClose: () => void;
  onPick: (seconds: number | null) => void;
}) {
  const s = useStyles(styles);
  const { t } = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('workout.rest.title')}>
      <AppText color="ink2">{t('workout.rest.intro')}</AppText>
      <View style={s.grid} accessibilityRole="radiogroup">
        {OPTIONS.map(([v, key]) => {
          const on = v === current;
          const label = v == null ? t('workout.rest.default') : v === 0 ? t('workout.rest.off') : key;
          const text = v == null ? `${label} (${Math.floor(defaultSeconds / 60)}:${String(defaultSeconds % 60).padStart(2, '0')})` : label;
          return (
            <Pressable
              key={key}
              onPress={() => onPick(v)}
              style={[s.opt, on && s.on]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <AppText variant="label" color={on ? 'bg' : 'ink'}>
                {text}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    opt: {
      minWidth: 72,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    on: { backgroundColor: t.colors.ink, borderColor: t.colors.ink },
  });
