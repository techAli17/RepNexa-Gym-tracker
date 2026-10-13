import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { BUILT_IN_EXERCISES } from '../../../data/exercises/builtInExercises';
import { createTestApp, fakeNavigation, renderWithApp, resetTestDatabases } from '../../../test/renderScreen';
import { HistoryScreen } from '../HistoryScreen';

jest.mock('@react-navigation/native', () => require('../../../test/renderScreen').navigationMock());
afterAll(() => resetTestDatabases());

const squat = BUILT_IN_EXERCISES.find(e => e.trackingType === 'weight_reps')!;

async function logWorkout(app: Awaited<ReturnType<typeof createTestApp>>, name: string) {
  const w = app.services.workouts;
  let d = await w.startEmpty('kg');
  d = await w.addExercise(d.workout.id, squat.id, 'kg');
  await w.updateSet(d.exercises[0].sets[0].id, { weightValue: 100, reps: 5 });
  await w.setCompleted(d.exercises[0].sets[0].id, true);
  await w.rename(d.workout.id, name);
  app.clock.advance(3_600_000);
  await w.complete(d.workout.id);
  app.clock.advance(86_400_000);
  return d.workout.id;
}

async function mount(app: Awaited<ReturnType<typeof createTestApp>>) {
  const navigation = fakeNavigation();
  await renderWithApp(app.ctx, <HistoryScreen navigation={navigation as never} route={{ key: 'h', name: 'History' } as never} />);
  return navigation;
}

describe('HistoryScreen', () => {
  it('invites a first workout when history is empty', async () => {
    const app = await createTestApp();
    await mount(app);
    expect(await screen.findByText('No workouts yet')).toBeOnTheScreen();
  });

  it('lists finished workouts newest first and opens one', async () => {
    const app = await createTestApp();
    await logWorkout(app, 'Leg day A');
    const second = await logWorkout(app, 'Leg day B');
    const navigation = await mount(app);
    const rows = await screen.findAllByText(/^Leg day [AB]$/);
    expect(rows.map(r => r.props.children)).toEqual(['Leg day B', 'Leg day A']);
    await userEvent.setup().press(rows[0]);
    expect(navigation.navigate).toHaveBeenCalledWith('WorkoutDetail', { id: second });
  });

  it('links to workouts kept only in Drive', async () => {
    const app = await createTestApp();
    await logWorkout(app, 'Recent');
    await app.db.run('INSERT INTO pruned_workouts (workout_id, started_at, pruned_at) VALUES (?, ?, ?), (?, ?, ?)', [
      'old-1', 1, 2, 'old-2', 1, 2,
    ]);
    const navigation = await mount(app);
    await userEvent.setup().press(await screen.findByText('Older workouts in your Drive (2)'));
    expect(navigation.navigate).toHaveBeenCalledWith('DriveHistory');
  });
});
