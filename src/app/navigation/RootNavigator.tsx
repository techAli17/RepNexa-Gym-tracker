import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '../../components/common/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { ProgressScreen } from '../../features/analytics/ProgressScreen';
import { HomeScreen } from '../../features/dashboard/HomeScreen';
import { ExerciseDetailScreen } from '../../features/exercises/ExerciseDetailScreen';
import { ExerciseFormScreen } from '../../features/exercises/ExerciseFormScreen';
import { ExerciseLibraryScreen, ExercisePickerScreen } from '../../features/exercises/ExerciseListScreen';
import { HistoryScreen } from '../../features/history/HistoryScreen';
import { WorkoutDetailScreen } from '../../features/history/WorkoutDetailScreen';
import { RoutineEditorScreen } from '../../features/routines/RoutineEditorScreen';
import { RoutinesScreen } from '../../features/routines/RoutinesScreen';
import { WeekPlanScreen } from '../../features/plan/WeekPlanScreen';
import { GymProfileScreen } from '../../features/settings/GymProfileScreen';
import { BackupScreen } from '../../features/settings/BackupScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { WorkoutScreen } from '../../features/workouts/WorkoutScreen';
import { WorkoutSummaryScreen } from '../../features/workouts/WorkoutSummaryScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICON: Record<keyof TabParamList, IconName> = {
  Home: 'home',
  History: 'history',
  Exercises: 'library',
  Progress: 'progress',
  Settings: 'settings',
};

function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: t.colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 24, color: t.colors.ink },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.ink3,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Icon name={TAB_ICON[route.name]} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'RepNexa', tabBarLabel: 'Home' }} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Exercises" component={ExerciseLibraryScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
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
          // A bare chevron; otherwise iOS shows the previous route's name ("Tabs").
          headerBackButtonDisplayMode: 'minimal',
          // Also the back button's accessibility label, which would otherwise be "Tabs".
          headerBackTitle: 'Back',
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
        <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: '' }} />
        <Stack.Screen name="ExerciseForm" component={ExerciseFormScreen} options={{ title: 'New exercise', presentation: 'modal' }} />
        <Stack.Screen name="Routines" component={RoutinesScreen} options={{ title: 'Routines' }} />
        <Stack.Screen name="RoutineEditor" component={RoutineEditorScreen} options={{ title: 'Routine' }} />
        <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Backup and data' }} />
        <Stack.Screen name="WeekPlan" component={WeekPlanScreen} options={{ title: 'Weekly plan' }} />
        <Stack.Screen name="GymProfile" component={GymProfileScreen} options={{ title: 'My gym' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
