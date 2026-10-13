import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useBackupStatus } from '../../app/AppContext';
import type { BackupSchedulerState } from '../../application/backup/BackupScheduler';
import { useNow } from '../../hooks/useNow';
import { t, useT, type TKey } from '../../i18n';
import { en } from '../../i18n/locales/en';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

export function ago(ts: number, now: number): string {
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return t('backup.ago.justNow');
  if (m < 60) return t('backup.ago.minutes', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('backup.ago.hours', { h });
  return t('backup.ago.days', { d: Math.floor(h / 24) });
}

const CLOUD_KEYS = new Map(Object.entries(en.backup.cloud.messages).map(([k, v]) => [v, `backup.cloud.messages.${k}` as TKey]));

/**
 * A Drive / sign-in error message in the active language. The cloud layer throws
 * English; messages it did not write (Google's own) are shown as they are.
 */
export function cloudMessage(message: string): string {
  const key = CLOUD_KEYS.get(message);
  if (key) return t(key);
  const invalid = /^The backup in your Drive could not be read: ([\s\S]*)$/.exec(message);
  if (invalid) return t('backup.cloud.remoteInvalid', { detail: invalid[1] });
  const failed = /^Drive request failed \((\d+)\)\.$/.exec(message);
  if (failed) return t('backup.cloud.requestFailed', { status: failed[1] });
  return message;
}

/** One honest sentence about where the user's data is right now. */
export function backupSentence(s: BackupSchedulerState, now: number): { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  switch (s.phase) {
    case 'notConfigured':
      return { text: t('backup.status.phoneOnly'), tone: 'neutral' };
    case 'signedOut':
      return { text: t('backup.status.signedOut'), tone: 'neutral' };
    case 'needsDrive':
      return { text: s.error ? t('backup.status.driveNeeded') : t('backup.status.turnOnDrive'), tone: 'warn' };
    case 'running':
      return { text: t('backup.status.running'), tone: 'neutral' };
    case 'retrying':
      return {
        text: t('backup.status.waiting', { reason: s.error ? cloudMessage(s.error.message) : t('backup.status.retrying') }),
        tone: 'warn',
      };
    case 'error':
      return {
        text: t('backup.status.stopped', { reason: s.error ? cloudMessage(s.error.message) : t('backup.status.unknownProblem') }),
        tone: 'bad',
      };
    default:
      if (s.pending) return { text: s.phase === 'off' ? t('backup.status.pendingOff') : t('backup.status.pending'), tone: 'warn' };
      if (s.lastSuccessAt) return { text: t('backup.status.backedUp', { when: ago(s.lastSuccessAt, now) }), tone: 'good' };
      return { text: t('backup.status.never'), tone: 'warn' };
  }
}

export function BackupStatus({ onPress }: { onPress?: () => void }) {
  const state = useBackupStatus(s => s);
  const now = useNow(60_000);
  const s = useStyles(styles);
  const theme = useTheme();
  // Re-renders on a language change; the sentence itself reads the active language.
  const { t: tr } = useT();
  const { text, tone } = backupSentence(state, now);
  const dot = { good: theme.colors.good, warn: theme.colors.amber, bad: theme.colors.danger, neutral: theme.colors.ink3 }[tone];
  return (
    <Pressable
      style={s.chip}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={text}
      accessibilityHint={onPress ? tr('backup.status.openHint') : undefined}
    >
      <View style={[s.dot, { backgroundColor: dot }]} />
      <Icon name="cloud" size={16} tint="ink2" />
      <AppText variant="caption" color="ink2" numberOfLines={2} style={s.text}>
        {text}
      </AppText>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 999,
      paddingVertical: 6,
      paddingLeft: 10,
      paddingRight: 14,
      minHeight: 36,
      maxWidth: '100%',
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    text: { flexShrink: 1, fontWeight: '500' },
  });
