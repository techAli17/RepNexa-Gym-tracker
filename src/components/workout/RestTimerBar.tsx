import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { useActiveWorkout } from '../../app/AppContext';
import { useNow } from '../../hooks/useNow';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatClock } from '../../utils/format';
import { AppText } from '../common/AppText';

/**
 * In-app rest countdown. Based on an end timestamp, so it stays correct after
 * the app is backgrounded. It does not alert while the app is closed: that
 * needs a scheduled local notification (Phase 3) and may be denied.
 */
export function RestTimerBar() {
  const rest = useActiveWorkout(s => s.rest);
  const adjust = useActiveWorkout(s => s.adjustRest);
  const clear = useActiveWorkout(s => s.clearRest);
  const now = useNow(250, rest != null);
  const s = useStyles(styles);
  const t = useTheme();
  const fired = useRef<number | null>(null);

  const left = rest ? Math.max(0, rest.endsAt - now) : 0;
  useEffect(() => {
    if (rest && left <= 0 && fired.current !== rest.endsAt) {
      fired.current = rest.endsAt;
      Vibration.vibrate([0, 60, 80, 60]);
      AccessibilityInfo.announceForAccessibility('Rest over. Time for your next set.');
      clear();
    }
  }, [rest, left, clear]);

  if (!rest) return null;
  const fraction = Math.min(1, left / (rest.totalSeconds * 1000));

  return (
    <View style={s.bar} accessibilityLabel={`Rest timer, ${formatClock(left)} left`}>
      <View style={s.main}>
        <AppText variant="caption" style={s.dim}>
          Rest
        </AppText>
        <AppText style={s.clock}>{formatClock(left)}</AppText>
        <View style={s.track}>
          <View style={[s.fill, { width: `${fraction * 100}%`, backgroundColor: t.colors.amber }]} />
        </View>
      </View>
      <Pill label="−15" a11y="Subtract 15 seconds" onPress={() => adjust(-15)} />
      <Pill label="+15" a11y="Add 15 seconds" onPress={() => adjust(15)} />
      <Pill label="Skip" a11y="Skip rest" onPress={clear} strong />
    </View>
  );
}

function Pill({ label, a11y, onPress, strong }: { label: string; a11y: string; onPress: () => void; strong?: boolean }) {
  const s = useStyles(styles);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={[s.pill, strong && s.pillStrong]}>
      <AppText variant="label" style={strong ? s.pillStrongText : s.pillText}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.colors.ink,
      borderRadius: 20,
      paddingVertical: 10,
      paddingLeft: 16,
      paddingRight: 10,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    main: { flex: 1 },
    dim: { color: t.colors.bg, opacity: 0.7 },
    clock: { color: t.colors.bg, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
    track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(127,127,127,0.35)', marginTop: 4, overflow: 'hidden' },
    fill: { height: 4, borderRadius: 2 },
    pill: { minWidth: 48, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,127,127,0.25)', paddingHorizontal: 8 },
    pillText: { color: t.colors.bg },
    pillStrong: { backgroundColor: t.colors.amber },
    pillStrongText: { color: t.colors.onAmber, fontWeight: '800' },
  });
