import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { WorkoutSet } from '../../../domain/models';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { setLabels } from '../ExerciseBlock';
import { SetRow, type SetRowProps } from '../SetRow';

const baseSet: WorkoutSet = {
  id: 'set-1',
  workoutExerciseId: 'we-1',
  position: 0,
  setType: 'normal',
  weightValue: 100,
  weightUnit: 'kg',
  reps: 5,
  durationSeconds: null,
  distanceValue: null,
  distanceUnit: null,
  rpe: null,
  completedAt: null,
  createdAt: 0,
  updatedAt: 0,
};

async function renderRow(over: Partial<SetRowProps> = {}) {
  const props: SetRowProps = {
    set: baseSet,
    label: '1',
    tracking: 'weight_reps',
    previous: undefined,
    unit: 'kg',
    onUpdate: jest.fn().mockResolvedValue(undefined),
    onToggle: jest.fn(),
    onCycleType: jest.fn(),
    ...over,
  };
  await render(
    <ThemeProvider preference="light">
      <SetRow {...props} />
    </ThemeProvider>,
  );
  return props;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('SetRow', () => {
  it('shows values in the viewer unit and the previous performance', async () => {
    await renderRow({
      unit: 'lb',
      previous: { ...baseSet, weightValue: 90, reps: 8 },
    });
    expect(screen.getByLabelText('Set 1, weight in lb').props.value).toBe('220.46');
    expect(screen.getByLabelText('Set 1, reps').props.value).toBe('5');
    expect(screen.getByText('198.4 × 8')).toBeOnTheScreen();
  });

  it('saves an edited weight in the viewer unit after a short pause', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const props = await renderRow({ unit: 'lb' });
    const field = screen.getByLabelText('Set 1, weight in lb');
    await user.clear(field);
    await user.type(field, '225', { submitEditing: false, skipBlur: true });
    expect(props.onUpdate).not.toHaveBeenCalledWith('set-1', { weightValue: 225, weightUnit: 'lb' });
    await act(() => jest.advanceTimersByTime(600));
    expect(props.onUpdate).toHaveBeenLastCalledWith('set-1', { weightValue: 225, weightUnit: 'lb' });
  });

  it('flags an invalid number and does not save it', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const props = await renderRow();
    const reps = screen.getByLabelText('Set 1, reps');
    await user.clear(reps);
    await user.type(reps, '7.5');
    await act(() => jest.advanceTimersByTime(600));
    expect(props.onUpdate).not.toHaveBeenCalledWith('set-1', { reps: 7.5 });
    expect(screen.getByLabelText('Set 1, reps').props.accessibilityHint).toBe('Invalid number');
  });

  it('exposes the check as an accessible checkbox and the badge as a set-type button', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const props = await renderRow({ set: { ...baseSet, completedAt: 123 } });
    const check = screen.getByRole('checkbox', { name: 'Set 1 done' });
    expect(check).toBeChecked();
    await user.press(check);
    expect(props.onToggle).toHaveBeenCalledWith('set-1');
    await user.press(screen.getByRole('button', { name: 'Set 1, working set' }));
    expect(props.onCycleType).toHaveBeenCalledWith('set-1');
  });

  it('renders seconds for timed exercises', async () => {
    await renderRow({ tracking: 'duration', set: { ...baseSet, weightValue: null, reps: null, durationSeconds: 60 } });
    expect(screen.getByLabelText('Set 1, seconds').props.value).toBe('60');
    expect(screen.queryByLabelText('Set 1, reps')).toBeNull();
  });
});

describe('setLabels', () => {
  it('numbers working sets and letters the rest', () => {
    const t = (setType: WorkoutSet['setType']) => ({ ...baseSet, setType });
    expect(setLabels([t('warmup'), t('normal'), t('normal'), t('drop'), t('failure'), t('normal')])).toEqual([
      'W', '1', '2', 'D', 'F', '3',
    ]);
  });
});
