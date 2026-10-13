import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { muscleHighlight } from '../../../domain/models';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { describeHighlight, MuscleMap } from '../MuscleMap';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider preference="light">{ui}</ThemeProvider>);

describe('MuscleMap', () => {
  it('describes the highlighted muscles for screen readers', async () => {
    const h = muscleHighlight({ muscleGroup: 'chest', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'front delts'] });
    await wrap(<MuscleMap highlight={h} />);
    expect(screen.getByRole('image')).toHaveAccessibleName('Muscle map. Main: chest. Also works: triceps, front shoulders.');
    expect(screen.getByText('Front')).toBeOnTheScreen();
    expect(screen.getByText('Back')).toBeOnTheScreen();
    expect(screen.getByText('Also works')).toBeOnTheScreen();
  });

  it('hides the secondary legend when there is none', async () => {
    await wrap(<MuscleMap highlight={{ primary: ['quads'], secondary: [] }} />);
    expect(screen.queryByText('Also works')).toBeNull();
  });

  it('renders nothing when no muscle is known (e.g. cardio)', async () => {
    await wrap(<MuscleMap highlight={muscleHighlight({ muscleGroup: 'cardio', primaryMuscles: [], secondaryMuscles: [] })} />);
    expect(screen.queryByTestId('muscle-map')).toBeNull();
  });

  it('builds a short label without secondaries', () => {
    expect(describeHighlight({ primary: ['lats', 'biceps'], secondary: [] })).toBe('Muscle map. Main: lats, biceps.');
  });
});
