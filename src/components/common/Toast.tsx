import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';

export function Toast() {
  const { message, id, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  const s = useStyles(styles);

  useEffect(() => {
    if (!message) return;
    AccessibilityInfo.announceForAccessibility(message);
    const h = setTimeout(hide, 2600);
    return () => clearTimeout(h);
  }, [message, id, hide]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={[s.wrap, { top: insets.top + 8 }]}>
      <View style={s.toast} accessibilityLiveRegion="polite">
        <AppText variant="label" style={s.text}>
          {message}
        </AppText>
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
    toast: {
      backgroundColor: t.colors.ink,
      borderRadius: t.radii.md,
      paddingHorizontal: 16,
      paddingVertical: 11,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    text: { color: t.colors.bg, textAlign: 'center' },
  });
