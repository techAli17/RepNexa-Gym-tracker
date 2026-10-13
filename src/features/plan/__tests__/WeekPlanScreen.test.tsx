import React from 'react';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { createTestApp, fakeNavigation, renderWithApp, resetTestDatabases } from '../../../test/renderScreen';
import { WeekPlanScreen } from '../WeekPlanScreen';

jest.mock('@react-navigation/native', () => require('../../../test/renderScreen').navigationMock());
afterAll(() => resetTestDatabases());

async function setup() {
  const app = await createTestApp();
  const navigation = fakeNavigation();
  await renderWithApp(app.ctx, <WeekPlanScreen navigation={navigation as never} route={{ key: 'w', name: 'WeekPlan' } as never} />);
  await screen.findByText('Week starts on');
  return { ...app, navigation };
}

describe('WeekPlanScreen', () => {
  it('marks a day as rest and saves it', async () => {
    const { services } = await setup();
    // Switch toggles report through onValueChange, which press events do not reach.
    await act(() => fireEvent(screen.getByLabelText('Wednesday is a rest day'), 'valueChange', true));
    await waitFor(async () => {
      const plan = await services.plan.get();
      expect(plan.days.find(d => d.weekday === 3)?.kind).toBe('rest');
    });
    expect(await screen.findByText('Rest day')).toBeOnTheScreen();
    expect(screen.getByText(/1 rest day/)).toBeOnTheScreen();
  });

  it('reorders the week when the start day changes', async () => {
    const { services } = await setup();
    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'Sun' }));
    await waitFor(async () => expect((await services.plan.get()).weekStart).toBe(0));
    await waitFor(() => {
      const headings = screen.getAllByText(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/);
      expect(headings[0]).toHaveTextContent(/^Sunday/);
    });
  });

  it('opens the exercise editor for an unplanned day', async () => {
    const { navigation } = await setup();
    const user = userEvent.setup();
    await user.press(screen.getAllByRole('button', { name: 'Add exercises' })[0]);
    expect(navigation.navigate).toHaveBeenCalledWith('RoutineEditor', expect.objectContaining({ planDay: expect.any(Number) }));
  });
});
