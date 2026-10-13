import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useT } from '../../i18n';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { Button } from './Button';
import { Sheet } from './Sheet';

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function TextPrompt({
  visible,
  title,
  initial,
  placeholder,
  multiline,
  maxLength = 80,
  confirmLabel,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initial: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const s = useStyles(styles);
  const t = useTheme();
  const { t: tr } = useT();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  return (
    <Sheet visible={visible} onClose={onCancel} title={title}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={t.colors.ink3}
        autoFocus
        multiline={multiline}
        maxLength={maxLength}
        accessibilityLabel={title}
        returnKeyType={multiline ? 'default' : 'done'}
        onSubmitEditing={multiline ? undefined : () => onSubmit(value)}
        style={[s.input, multiline && s.multi]}
      />
      <View style={s.actions}>
        <Button label={confirmLabel ?? tr('common.save')} variant="ink" onPress={() => onSubmit(value)} />
        <Button label={tr('common.cancel')} variant="outline" onPress={onCancel} />
      </View>
    </Sheet>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface2,
      paddingHorizontal: 12,
      fontSize: 16,
      color: t.colors.ink,
    },
    multi: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
    actions: { gap: 8, marginTop: 16 },
  });
