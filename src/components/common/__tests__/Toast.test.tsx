import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { toast, toastError, useToastStore } from '../../../store/toastStore';
import { DomainError } from '../../../domain/errors';
import { STORAGE_FULL_MESSAGE } from '../../../infrastructure/storageErrors';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { Toast } from '../Toast';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

async function mount() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider preference="light">
        <Toast />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  // After mounting: the async render settles on real timers.
  jest.useFakeTimers();
}

beforeEach(() => act(() => useToastStore.getState().hide()));
afterEach(() => jest.useRealTimers());

describe('Toast', () => {
  it('shows a message and hides it after a few seconds', async () => {
    await mount();
    await act(() => toast('Workout saved'));
    expect(screen.getByText('Workout saved')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByText('Workout saved')).toBeNull();
  });

  it('shows the plain-language storage-full message for that error', async () => {
    await mount();
    await act(() => toastError(new DomainError('STORAGE_FULL', STORAGE_FULL_MESSAGE)));
    expect(screen.getByText(STORAGE_FULL_MESSAGE)).toBeOnTheScreen();
  });
});
