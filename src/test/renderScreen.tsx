import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStore } from 'zustand/vanilla';
import { AppContextProvider, type AppContextValue } from '../app/AppContext';
import { BackupScheduler, type BackupSchedulerState } from '../application/backup/BackupScheduler';
import type { AuthGateway, CloudBackupStore } from '../application/ports/cloud';
import { createActiveWorkoutStore } from '../store/activeWorkoutStore';
import { createSettingsStore } from '../store/settingsStore';
import { ThemeProvider } from '../theme/ThemeProvider';
import { createTestServices } from './testServices';

/** Signed-out auth: screens under test never reach Google. */
const offlineAuth = {
  current: async () => null,
} as unknown as AuthGateway;
const noCloud = {} as CloudBackupStore;

/**
 * A full app context on a real (better-sqlite3) database, for screen tests.
 * Services, settings and the active-workout store are the real ones; Google
 * and navigation are stubbed.
 */
export async function createTestApp() {
  const t = await createTestServices();
  const settings = createSettingsStore(t.services);
  await settings.getState().load();
  const activeWorkout = createActiveWorkoutStore(t.services, () => settings.getState().settings);
  await activeWorkout.getState().load();
  const backupStatus = createStore<BackupSchedulerState>()(() => ({
    phase: 'idle',
    account: null,
    pending: false,
    lastSuccessAt: null,
    error: null,
    nextAttemptAt: null,
    lastOutcome: null,
  }));
  const scheduler = new BackupScheduler({
    backup: t.services.backup,
    auth: offlineAuth,
    cloud: noCloud,
    autoBackupEnabled: () => false,
    onState: s => backupStatus.setState(s, true),
  });
  const ctx: AppContextValue = {
    services: t.services,
    settings,
    activeWorkout,
    backupStatus,
    scheduler,
    auth: offlineAuth,
    owner: 'test',
    account: {
      signIn: jest.fn(),
      connectDrive: jest.fn(),
      signOut: jest.fn(),
      disconnect: jest.fn(),
      wipeLocal: jest.fn(),
    },
  };
  return { ...t, ctx, settings, activeWorkout };
}

export function fakeNavigation() {
  return {
    navigate: jest.fn(),
    push: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => undefined),
  };
}

/** Renders a screen inside the app context and light theme. */
export function renderWithApp(ctx: AppContextValue, ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <AppContextProvider value={ctx}>
        <ThemeProvider preference="light">{ui}</ThemeProvider>
      </AppContextProvider>
    </SafeAreaProvider>,
  );
}

/**
 * Screens load with useFocusEffect; in tests a screen is "focused" from mount.
 * Use in a test file as:
 *   jest.mock('@react-navigation/native', () => require('../../test/renderScreen').navigationMock());
 */
export function navigationMock() {
  const actual = jest.requireActual('@react-navigation/native');
  const { useEffect } = jest.requireActual('react');
  return {
    ...actual,
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    useNavigation: () => fakeNavigation(),
  };
}

export { resetAllDatabases as resetTestDatabases } from './testServices';
