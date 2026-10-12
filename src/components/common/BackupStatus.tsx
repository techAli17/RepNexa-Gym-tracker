import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useBackupStatus } from '../../app/AppContext';
import type { BackupSchedulerState } from '../../application/backup/BackupScheduler';
import { useNow } from '../../hooks/useNow';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

export function ago(ts: number, now: number): string {
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** One honest sentence about where the user's data is right now. */
export function backupSentence(s: BackupSchedulerState, now: number): { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  switch (s.phase) {
    case 'notConfigured':
      return { text: 'Saved on this phone only', tone: 'neutral' };
    case 'signedOut':
      return { text: 'Saved on this phone only. Sign in to back up.', tone: 'neutral' };
    case 'needsDrive':
      return { text: s.error ? 'Drive access needed to keep backing up' : 'Turn on Drive backup', tone: 'warn' };
    case 'running':
      return { text: 'Backing up to your Drive…', tone: 'neutral' };
    case 'retrying':
      return { text: `Backup waiting: ${s.error?.message ?? 'retrying'}`, tone: 'warn' };
    case 'error':
      return { text: `Backup stopped: ${s.error?.message ?? 'unknown problem'}`, tone: 'bad' };
    default:
      if (s.pending) return { text: s.phase === 'off' ? 'Changes not backed up (auto backup off)' : 'Changes waiting to back up', tone: 'warn' };
      if (s.lastSuccessAt) return { text: `Backed up to your Drive ${ago(s.lastSuccessAt, now)}`, tone: 'good' };
      return { text: 'Not backed up yet', tone: 'warn' };
  }
}

export function BackupStatus({ onPress }: { onPress?: () => void }) {
  const state = useBackupStatus(s => s);
  const now = useNow(60_000);
  const s = useStyles(styles);
  const t = useTheme();
  const { text, tone } = backupSentence(state, now);
  const dot = { good: t.colors.good, warn: t.colors.amber, bad: t.colors.danger, neutral: t.colors.ink3 }[tone];
  return (
    <Pressable
      style={s.chip}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={text}
      accessibilityHint={onPress ? 'Opens backup settings' : undefined}
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
