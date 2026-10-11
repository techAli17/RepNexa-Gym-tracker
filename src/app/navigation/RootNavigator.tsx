import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/ThemeProvider';
import { HomeScreen } from '../../features/dashboard/HomeScreen';
import { HistoryScreen } from '../../features/history/HistoryScreen';
import { WorkoutDetailScreen } from '../../features/history/WorkoutDetailScreen';
import { ExerciseDetailScreen } from '../../features/exercises/ExerciseDetailScreen';
import { ExerciseLibraryScreen, ExercisePickerScreen } from '../../features/exercises/ExerciseListScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { WorkoutScreen } from '../../features/workouts/WorkoutScreen';
import { WorkoutSummaryScreen } from '../../features/workouts/WorkoutSummaryScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/** Icons arrive with the Phase 2 design system; until then tabs are text-only. */
function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 22, color: t.colors.ink },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.ink3,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.line },
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
        tabBarLabelPosition: 'beside-icon',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'RepNexa' }} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Exercises" component={ExerciseLibraryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const t = useTheme();
  const navTheme: NavTheme = useMemo(() => {
    const base = t.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.colors.accent,
        background: t.colors.bg,
        card: t.colors.surface,
        text: t.colors.ink,
        border: t.colors.line,
      },
    };
  }, [t]);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: t.colors.bg },
          headerShadowVisible: false,
          headerTintColor: t.colors.ink,
          contentStyle: { backgroundColor: t.colors.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Workout"
          component={WorkoutScreen}
          options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen name="ExercisePicker" component={ExercisePickerScreen} options={{ title: 'Add exercise', presentation: 'modal' }} />
        <Stack.Screen
          name="WorkoutSummary"
          component={WorkoutSummaryScreen}
          options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }}
        />
        <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: '' }} />
        <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: '', presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
