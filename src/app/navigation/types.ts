import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  History: undefined;
  Exercises: undefined;
  Progress: undefined;
  Settings: undefined;
};

/** What the exercise picker does with the chosen exercise. */
export type PickerMode =
  | { mode: 'add' }
  | { mode: 'replace'; workoutExerciseId: string; exerciseId: string }
  | { mode: 'routine' };

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Workout: undefined;
  ExercisePicker: PickerMode;
  WorkoutSummary: undefined;
  WorkoutDetail: { id: string };
  ExerciseDetail: { id: string };
  /** Create (no id) or edit a custom exercise. `pickFor` selects it in the picker flow afterwards. */
  ExerciseForm: { id?: string; pickFor?: PickerMode };
  Routines: undefined;
  /**
   * `addExerciseId` is how the picker hands an exercise back to the editor.
   * `planDay` (0 = Sunday … 6 = Saturday) assigns a newly created routine to that day of the weekly plan.
   */
  RoutineEditor: { id?: string; addExerciseId?: string; addNonce?: number; planDay?: number };
  WeekPlan: undefined;
  GymProfile: undefined;
  Backup: undefined;
};

export type RootScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

export type TabScreenProps<K extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, K>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
