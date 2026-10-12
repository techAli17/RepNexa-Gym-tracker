import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import type { ColorTokens } from '../../theme/tokens';

/** 24×24 stroke icons drawn for RepNexa. Decorative: callers label the control, not the icon. */
const ICONS = {
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  history: (
    <>
      <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <Path d="M3 3v5h5" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  library: <Path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  progress: (
    <>
      <Path d="M3 20h18" />
      <Path d="m5 15 4-5 4 3 6-8" />
      <Path d="M15 5h4v4" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  play: <Path d="M8 5.5v13l11-6.5z" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  chevronRight: <Path d="m9 6 6 6-6 6" />,
  more: <Path d="M5 12h.01M12 12h.01M19 12h.01" />,
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m20 20-4-4" />
    </>
  ),
  trophy: (
    <>
      <Path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5" />
    </>
  ),
  cloud: <Path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z" />,
  shield: (
    <>
      <Path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z" />
      <Path d="m8.5 12 2.5 2.5 4.5-4.5" />
    </>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  edit: <Path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  trash: <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  swap: <Path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  timer: (
    <>
      <Circle cx="12" cy="13" r="8" />
      <Path d="M12 9v4l2 2M9 2h6" />
    </>
  ),
  pause: <Path d="M9 5v14M15 5v14" />,
  barbell: <Path d="M2 12h20M5 7v10M8 8.5v7M19 7v10M16 8.5v7" />,
  dumbbell: <Path d="M7 12h10M4 9v6M7 7.5v9M17 7.5v9M20 9v6" />,
  machine: (
    <>
      <Rect x="5" y="3" width="14" height="18" rx="2" />
      <Path d="M9 7h6M9 11h6M9 15h6M12 15v6" />
    </>
  ),
  bodyweight: (
    <>
      <Circle cx="12" cy="4.5" r="2" />
      <Path d="M12 7v7M8 10l4-1 4 1M9 21l3-7 3 7" />
    </>
  ),
  cable: <Path d="M12 2v9M8 11h8l-1 4H9zM12 15v6M9 21h6" />,
  upload: <Path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  download: <Path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  copy: (
    <>
      <Rect x="8" y="8" width="12" height="12" rx="2" />
      <Path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  arrowUp: <Path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <Path d="M12 5v14M6 13l6 6 6-6" />,
} as const;

export type IconName = keyof typeof ICONS;

const EQUIPMENT_ICON: Record<string, IconName> = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  machine: 'machine',
  bodyweight: 'bodyweight',
  cable: 'cable',
  kettlebell: 'dumbbell',
  band: 'cable',
  other: 'library',
};
export const iconForEquipment = (eq: string): IconName => EQUIPMENT_ICON[eq] ?? 'library';

export function Icon({
  name,
  size = 22,
  color,
  tint,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  /** Raw color, e.g. from a tab bar. Takes precedence over `tint`. */
  color?: string;
  tint?: keyof ColorTokens;
  strokeWidth?: number;
}) {
  const t = useTheme();
  const c = color ?? t.colors[tint ?? 'ink'];
  const filled = name === 'play';
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? c : 'none'}
      stroke={c}
      strokeWidth={name === 'more' ? 3.2 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name]}
    </Svg>
  );
}
