import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';

export function Toast() {
  const { message, id, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  const s = useStyles(styles);
  const reduce = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    // Slides down and fades in; appears at once under Reduce Motion.
    enter.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    AccessibilityInfo.announceForAccessibility(message);
    const h = setTimeout(hide, 2600);
    return () => clearTimeout(h);
  }, [message, id, hide, enter, reduce]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={[s.wrap, { top: insets.top + 8 }]}>
      <Animated.View
        style={[
          s.toast,
          { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
        ]}
        accessibilityLiveRegion="polite"
      >
        <AppText variant="label" style={s.text}>
          {message}
        </AppText>
      </Animated.View>
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
