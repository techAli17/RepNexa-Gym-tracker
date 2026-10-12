import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';

/** Bottom sheet built on Modal: scrim tap and the back button close it. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]} accessibilityViewIsModal>
          <View style={s.grab} />
          {title ? (
            <AppText variant="title" style={s.title} accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'flex-end' },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: t.colors.scrim },
    sheet: {
      maxHeight: '88%',
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 8,
    },
    grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.line, alignSelf: 'center', marginBottom: 12 },
    title: { marginBottom: 10 },
  });
