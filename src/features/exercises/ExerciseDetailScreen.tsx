import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useServices } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { EmptyState } from '../../components/common/EmptyState';
import type { Exercise } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { titleCase } from '../../utils/text';

export function ExerciseDetailScreen({ route }: RootScreenProps<'ExerciseDetail'>) {
  const services = useServices();
  const s = useStyles(styles);
  const [e, setE] = useState<Exercise | null | undefined>(undefined);

  useEffect(() => {
    services.exercises.get(route.params.id).then(setE, err => {
      toastError(err);
      setE(null);
    });
  }, [services, route.params.id]);

  if (e === undefined) return <View style={s.screen} />;
  if (e === null) return <EmptyState title="Exercise not found" />;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      {/* Placeholder until licensed illustrations are bundled (Phase 2). */}
      <View style={s.hero} accessibilityLabel="Illustration not available yet">
        <AppText style={s.heroLetter}>{e.name.charAt(0)}</AppText>
        <AppText variant="caption" color="ink3">
          Illustration coming soon
        </AppText>
      </View>
      <AppText variant="title" accessibilityRole="header">
        {e.name}
      </AppText>
      <AppText color="ink2" style={s.meta}>
        {titleCase(e.muscleGroup)} · {titleCase(e.equipment)}
        {e.isCustom ? ' · Custom' : ''}
      </AppText>
      {e.primaryMuscles.length ? <Section title="Primary muscles" body={e.primaryMuscles.map(titleCase).join(', ')} /> : null}
      {e.secondaryMuscles.length ? <Section title="Secondary muscles" body={e.secondaryMuscles.map(titleCase).join(', ')} /> : null}
      {e.instructions ? <Section title="How to do it" body={e.instructions} /> : null}
    </ScrollView>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  const s = useStyles(styles);
  return (
    <View style={s.section}>
      <AppText variant="label" color="ink3">
        {title}
      </AppText>
      <AppText style={s.sectionBody}>{body}</AppText>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    hero: {
      height: 150,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: t.colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    heroLetter: { fontSize: 56, fontWeight: '800', color: t.colors.ink3 },
    meta: { marginTop: 4 },
    section: { marginTop: 18 },
    sectionBody: { marginTop: 4 },
  });
