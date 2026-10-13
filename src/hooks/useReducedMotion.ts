import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';

let reduced = false;
AccessibilityInfo.isReduceMotionEnabled().then(
  v => {
    reduced = v;
  },
  () => undefined,
);
AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
  reduced = v;
});

/** True when the user asked the OS to reduce motion. */
export function useReducedMotion(): boolean {
  const [value, setValue] = useState(reduced);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setValue, () => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setValue);
    return () => sub.remove();
  }, []);
  return value;
}

/**
 * Animates the next layout change (rows appearing, moving, disappearing).
 * Short and plain; skipped entirely when the user reduces motion.
 */
export function animateNextLayout(): void {
  if (reduced) return;
  LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
}
