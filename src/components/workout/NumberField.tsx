import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { parseNumericInput } from '../../domain/validation';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { useT } from '../../i18n';
import { inputText } from '../../utils/format';

const COMMIT_DELAY_MS = 450;

/**
 * Android: a single-line EditText with centred text reports it can scroll
 * sideways, so React Native never hands a swipe that starts on it to the list,
 * and the workout screen (mostly number fields) would not scroll. A one-line
 * multiline field does not scroll sideways; maxLength keeps it to one line.
 */
const ANDROID_NO_HSCROLL = Platform.OS === 'android';

/** Commits of fields with a typed but not yet saved value, keyed per field. */
const pending = new Map<symbol, () => Promise<void>>();

/**
 * Saves every field still inside its commit delay. Call before acting on set
 * values (checking a set off, finishing), so a value typed a moment ago counts.
 */
export async function flushPendingNumberFields(): Promise<void> {
  const jobs = [...pending.values()];
  pending.clear();
  await Promise.all(jobs.map(j => j().catch(() => undefined)));
}

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
export const NumberField = React.memo(function NumberFieldInput({
  value,
  onCommit,
  integer,
  placeholder = '0',
  accessibilityLabel,
  muted,
}: NumberFieldProps) {
  const s = useStyles(styles);
  const theme = useTheme();
  const { t } = useT();
  const [text, setText] = useState(() => inputText(value));
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommitted = useRef<number | null>(value);
  const key = useRef(Symbol('field')).current;

  // Follow outside changes (e.g. unit switch, prefill) unless the user is typing.
  useEffect(() => {
    if (!focused.current) {
      setText(inputText(value));
      lastCommitted.current = value;
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      pending.delete(key);
    },
    [key],
  );

  const commit = (raw: string): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.delete(key);
    const v = parseNumericInput(raw);
    if (v === undefined || (integer && v != null && !Number.isInteger(v))) {
      setBad(true);
      return Promise.resolve();
    }
    if (v === lastCommitted.current) return Promise.resolve();
    const previous = lastCommitted.current;
    lastCommitted.current = v;
    return onCommit(v).then(
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
        timer.current = setTimeout(() => void commit(x), COMMIT_DELAY_MS);
        pending.set(key, () => commit(x));
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        void commit(text);
      }}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      inputMode={integer ? 'numeric' : 'decimal'}
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor={theme.colors.ink3}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={bad ? t('workout.set.invalidNumber') : undefined}
      maxLength={7}
      multiline={ANDROID_NO_HSCROLL}
      numberOfLines={1}
      submitBehavior="blurAndSubmit"
      // Fixed-width columns: cap scaling so large accessibility text still fits the field.
      maxFontSizeMultiplier={1.3}
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
      textAlignVertical: 'center', // Android multiline defaults to top
      // Android: no font/vertical padding, so the text fits the box and the field
      // does not report vertical scroll either (see ANDROID_NO_HSCROLL).
      paddingVertical: 0,
      includeFontPadding: false,
      paddingHorizontal: 4,
      ...t.type.number,
    },
    muted: { backgroundColor: 'transparent' },
    bad: { borderColor: t.colors.danger },
  });
