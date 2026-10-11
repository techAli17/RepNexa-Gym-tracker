import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.wrap} accessibilityRole="summary">
      <AppText variant="heading" style={s.center}>
        {title}
      </AppText>
      {message ? (
        <AppText color="ink2" style={[s.center, s.msg]}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={s.btn} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  center: { textAlign: 'center' },
  msg: { marginTop: 6 },
  btn: { marginTop: 18, alignSelf: 'stretch' },
});
