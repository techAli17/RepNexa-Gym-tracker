import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { parseNumericInput } from '../../domain/validation';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { inputText } from '../../utils/format';

const COMMIT_DELAY_MS = 450;

export interface NumberFieldProps {
  value: number | null;
  onCommit: (v: number | null) => Promise<void>;
  integer?: boolean;
  placeholder?: string;
  accessibilityLabel: string;
  muted?: boolean;
}

/**
 * Keeps its own text while typing and writes to the database after a short
 * pause or on blur. Saving mid-typing means an app kill loses at most the last
 * half second of input, without a write per keystroke.
 */
export const NumberField = React.memo(function NumberField({
  value,
  onCommit,
  integer,
  placeholder = '0',
  accessibilityLabel,
  muted,
}: NumberFieldProps) {
  const s = useStyles(styles);
  const t = useTheme();
  const [text, setText] = useState(() => inputText(value));
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommitted = useRef<number | null>(value);

  // Follow outside changes (e.g. unit switch, prefill) unless the user is typing.
  useEffect(() => {
    if (!focused.current) {
      setText(inputText(value));
      lastCommitted.current = value;
    }
  }, [value]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const commit = (raw: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const v = parseNumericInput(raw);
    if (v === undefined || (integer && v != null && !Number.isInteger(v))) {
      setBad(true);
      return;
    }
    if (v === lastCommitted.current) return;
    const previous = lastCommitted.current;
    lastCommitted.current = v;
    onCommit(v).then(
      () => setBad(false),
      () => {
        lastCommitted.current = previous; // not saved: allow the same value to be retried
        setBad(true);
      },
    );
  };

  return (
    <TextInput
      value={text}
      onChangeText={x => {
        setText(x);
        const v = parseNumericInput(x);
        setBad(v === undefined || (!!integer && v != null && !Number.isInteger(v)));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(x), COMMIT_DELAY_MS);
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commit(text);
      }}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      inputMode={integer ? 'numeric' : 'decimal'}
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor={t.colors.ink3}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={bad ? 'Invalid number' : undefined}
      maxLength={7}
      style={[s.input, muted && s.muted, bad && s.bad]}
    />
  );
});

const styles = (t: Theme) =>
  StyleSheet.create({
    input: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: t.colors.surface2,
      color: t.colors.ink,
      textAlign: 'center',
      paddingHorizontal: 4,
      ...t.type.number,
    },
    muted: { backgroundColor: 'transparent' },
    bad: { borderColor: t.colors.danger },
  });
