import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { ColorTokens } from '../../theme/tokens';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'number';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: keyof ColorTokens;
}

export function AppText({ variant = 'body', color = 'ink', style, ...rest }: AppTextProps) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[t.type[variant], { color: t.colors[color] }, style]}
    />
  );
}
