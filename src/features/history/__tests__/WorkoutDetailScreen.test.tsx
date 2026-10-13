import React from 'react';
import { Alert } from 'react-native';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { BUILT_IN_EXERCISES } from '../../../data/exercises/builtInExercises';
import { createTestApp, fakeNavigation, renderWithApp, resetTestDatabases } from '../../../test/renderScreen';
import { WorkoutDetailScreen } from '../WorkoutDetailScreen';

jest.mock('@react-navigation/native', () => require('../../../test/renderScreen').navigationMock());
afterAll(() => resetTestDatabases());

const [bench, row] = BUILT_IN_EXERCISES.filter(e => e.trackingType === 'weight_reps');

async function setup() {
  const app = await createTestApp();
  const w = app.services.workouts;
  let d = await w.startEmpty('kg');
  d = await w.addExercise(d.workout.id, bench.id, 'kg');
  const set = d.exercises[0].sets[0];
  await w.updateSet(set.id, { weightValue: 80, reps: 5 });
  await w.setCompleted(set.id, true);
  app.clock.advance(45 * 60_000);
  await w.complete(d.workout.id);

  const navigation = fakeNavigation();
  await renderWithApp(
    app.ctx,
    <WorkoutDetailScreen navigation={navigation as never} route={{ key: 'd', name: 'WorkoutDetail', params: { id: d.workout.id } } as never} />,
  );
  await screen.findByText(bench.name);
  return { ...app, navigation, workoutId: d.workout.id };
}

/** The Edit/Done button lives in the navigation header, which tests do not render; press the latest one directly. */
async function pressHeaderButton(navigation: ReturnType<typeof fakeNavigation>, label: 'Edit' | 'Done') {
  const calls = navigation.setOptions.mock.calls as unknown as Array<[{ headerRight: () => React.ReactElement<{ onPress(): void; children: React.ReactElement<{ children: string }> }> }]>;
  const button = calls[calls.length - 1][0].headerRight();
  expect(button.props.children.props.children).toBe(label);
  await act(async () => button.props.onPress());
}

describe('WorkoutDetailScreen', () => {
  it('shows the finished workout with its totals', async () => {
    await setup();
    expect(screen.getByText('Duration')).toBeOnTheScreen();
    expect(screen.getByText('Volume, kg')).toBeOnTheScreen();
    expect(screen.getByText('400')).toBeOnTheScreen(); // 80 kg × 5
  });

  it('adds an exercise from history and drops it on Done if nothing was ticked', async () => {
    const { navigation, services, workoutId } = await setup();
    await pressHeaderButton(navigation, 'Edit');
    await userEvent.setup().press(await screen.findByText('+ Add exercise'));
    expect(navigation.navigate).toHaveBeenCalledWith('ExercisePicker', { mode: 'history', workoutId });

    // What the picker does on return.
    await services.workouts.addExercise(workoutId, row.id, 'kg');
    expect((await services.history.detail(workoutId))?.exercises).toHaveLength(2);

    await waitFor(() => expect(navigation.setOptions).toHaveBeenCalled());
    await pressHeaderButton(navigation, 'Done');
    await waitFor(async () => expect((await services.history.detail(workoutId))?.exercises).toHaveLength(1));
  });

  it('deletes the workout after confirmation', async () => {
    const { navigation, services, workoutId } = await setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      void buttons?.find(b => b.text === 'Delete')?.onPress?.();
    });
    await userEvent.setup().press(screen.getByText('Delete workout'));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(await services.history.detail(workoutId)).toBeNull();
    alert.mockRestore();
    await act(async () => undefined);
  });
});
