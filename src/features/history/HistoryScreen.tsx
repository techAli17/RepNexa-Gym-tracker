import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useServices, useSettings } from '../../app/AppContext';
import type { TabScreenProps } from '../../app/navigation/types';
import { EmptyState } from '../../components/common/EmptyState';
import { WorkoutRow } from '../../components/workout/WorkoutRow';
import type { WorkoutListItem } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

const PAGE = 30;

export function HistoryScreen({ navigation }: TabScreenProps<'History'>) {
  const services = useServices();
  const unit = useSettings(s => s.settings.weightUnit);
  const s = useStyles(styles);
  const t = useTheme();
  const [items, setItems] = useState<WorkoutListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const done = useRef(false);

  const reload = useCallback(async () => {
    try {
      const first = await services.history.list({ limit: PAGE });
      done.current = first.length < PAGE;
      setItems(first);
    } catch (e) {
      toastError(e);
      setItems(prev => prev ?? []);
    }
  }, [services]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const loadMore = async () => {
    if (!items?.length || done.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await services.history.list({ limit: PAGE, startedBefore: items[items.length - 1].workout.startedAt });
      done.current = next.length < PAGE;
      setItems(cur => [...(cur ?? []), ...next]);
    } catch (e) {
      toastError(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const open = useCallback((id: string) => navigation.navigate('WorkoutDetail', { id }), [navigation]);

  if (items == null) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.colors.ink3} />
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.body}
      data={items}
      keyExtractor={i => i.workout.id}
      renderItem={({ item }) => <WorkoutRow item={item} unit={unit} onPress={open} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
      }}
      initialNumToRender={12}
      windowSize={7}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={s.more} color={t.colors.ink3} /> : undefined}
      ListEmptyComponent={
        <EmptyState
          title="No workouts yet"
          message="Your finished workouts will show up here."
          actionLabel="Go to Home"
          onAction={() => navigation.navigate('Home')}
        />
      }
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40, flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
    more: { marginVertical: 16 },
  });
