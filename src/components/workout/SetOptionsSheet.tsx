import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SET_TYPES, type SetType, type WorkoutSet } from '../../domain/models';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from '../common/AppText';
import { Button } from '../common/Button';
import { Sheet } from '../common/Sheet';

const TYPE_LABEL: Record<SetType, [string, string]> = {
  normal: ['Working set', 'Counts toward volume and records'],
  warmup: ['Warm-up', 'Excluded from volume and records'],
  drop: ['Drop set', 'A lighter set straight after the last'],
  failure: ['To failure', 'No reps left in the tank'],
};

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Set type and RPE (rate of perceived exertion, 1–10) for one set. */
export function SetOptionsSheet({
  set,
  onClose,
  onChange,
}: {
  set: WorkoutSet | null;
  onClose: () => void;
  onChange: (patch: Partial<WorkoutSet>) => void;
}) {
  const s = useStyles(styles);
  return (
    <Sheet visible={!!set} onClose={onClose} title="Set options">
      {set ? (
        <>
          <AppText variant="label" color="ink3" style={s.h}>
            Type
          </AppText>
          <View accessibilityRole="radiogroup">
            {SET_TYPES.map(type => {
              const on = set.setType === type;
              return (
                <Pressable
                  key={type}
                  style={[s.option, on && s.optionOn]}
                  onPress={() => onChange({ setType: type })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[s.radio, on && s.radioOn]} />
                  <View style={s.flex}>
                    <AppText variant="label">{TYPE_LABEL[type][0]}</AppText>
                    <AppText variant="caption" color="ink3">
                      {TYPE_LABEL[type][1]}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <AppText variant="label" color="ink3" style={s.h}>
            RPE
          </AppText>
          <AppText variant="caption" color="ink3">
            How hard the set felt. 10 means nothing left; 8 means about two more reps were possible.
          </AppText>
          <View style={s.rpeRow} accessibilityRole="radiogroup" accessibilityLabel="RPE">
            <RpeChip label="None" on={set.rpe == null} onPress={() => onChange({ rpe: null })} />
            {RPE_VALUES.map(v => (
              <RpeChip key={v} label={String(v)} on={set.rpe === v} onPress={() => onChange({ rpe: v })} />
            ))}
          </View>
          <Button label="Done" variant="ink" onPress={onClose} style={s.done} />
        </>
      ) : null}
    </Sheet>
  );
}

function RpeChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const s = useStyles(styles);
  return (
    <Pressable style={[s.chip, on && s.chipOn]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}>
      <AppText variant="label" color={on ? 'bg' : 'ink2'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    h: { marginTop: 10, marginBottom: 6 },
    flex: { flex: 1 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1.5,
      borderColor: t.colors.line,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
    },
    optionOn: { borderColor: t.colors.amber },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.colors.ink3 },
    radioOn: { borderColor: t.colors.amber, backgroundColor: t.colors.amber },
    rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: {
      minWidth: 48,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: { backgroundColor: t.colors.ink, borderColor: t.colors.ink },
    done: { marginTop: 18 },
  });
